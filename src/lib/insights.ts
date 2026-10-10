import { OWN_TRANSFER, payeeKey } from "./corrections";
import { payeeName } from "./payees";
import { spendType } from "./spending";

// "What changed": the latest full month next to the usual of the months
// before it. Every finding carries the numbers it was worked out from and the
// entries behind it, so the user can check it rather than take it on trust.
//
// Thresholds are relative to the user's own spending (a share of a normal
// month), not fixed amounts, so they mean the same for a student and a family
// and in any currency.

export type Evidence = { id: string; date: string; name: string; amount: number };

export type Insight =
  | {
      kind: "categoryUp" | "categoryDown";
      category: string;
      month: string;
      amount: number;
      usual: number;
      difference: number;
      /** The months the usual is worked out from, with what was spent in each. */
      basis: { month: string; amount: number }[];
      entries: Evidence[];
      count: number;
    }
  | { kind: "newPayee"; payee: string; month: string; amount: number; entries: Evidence[]; count: number }
  | {
      kind: "keptLess" | "keptMore";
      month: string;
      kept: number;
      usualKept: number;
      difference: number;
      /** Why: how income and spending moved against their usual. */
      incomeChange: number;
      spendingChange: number;
      basis: { month: string; kept: number }[];
    };

export type Insights = { ok: true; month: string; insights: Insight[] } | { ok: false; reason: "tooLittle" };

const BASELINE_MONTHS = 3;
const EVIDENCE_SHOWN = 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Month = {
  spend: Map<string, { amount: number; entries: Evidence[] }>;
  payees: Map<string, { name: string; amount: number; entries: Evidence[] }>;
  in: number;
  out: number;
};

/**
 * The latest month the entries fully cover: the month of the last entry if it
 * reaches the 25th and is not the current calendar month, else the month before.
 */
export function latestFullMonth(lastDate: string, today = new Date()): string {
  const month = lastDate.slice(0, 7);
  const current = today.toISOString().slice(0, 7);
  if (month < current && Number(lastDate.slice(8, 10)) >= 25) return month;
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function findInsights(transactions: Transaction[] = [], today = new Date()): Insights {
  const months = new Map<string, Month>();
  let lastDate = "";
  let firstDate = "";

  for (const t of transactions) {
    const date = String(t.date ?? "").slice(0, 10);
    const amount = Math.abs(Number(t.amount) || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount) continue;
    if (t.userCategory === OWN_TRANSFER) continue;
    if (date > lastDate) lastDate = date;
    if (!firstDate || date < firstDate) firstDate = date;
    const key = date.slice(0, 7);
    const m = months.get(key) ?? { spend: new Map(), payees: new Map(), in: 0, out: 0 };
    const evidence = { id: t.id, date, name: t.shownName || t.name, amount };
    if (t.type === "debit" || Number(t.amount) < 0) {
      m.out += amount;
      const category = spendType(t);
      const c = m.spend.get(category) ?? { amount: 0, entries: [] };
      c.amount += amount;
      c.entries.push(evidence);
      m.spend.set(category, c);
      const who = t.shownName?.toLowerCase() || payeeKey(t.name);
      if (who) {
        const p = m.payees.get(who) ?? { name: t.shownName || payeeName(t.name), amount: 0, entries: [] };
        p.amount += amount;
        p.entries.push(evidence);
        m.payees.set(who, p);
      }
    } else {
      m.in += amount;
    }
    months.set(key, m);
  }
  if (!lastDate) return { ok: false, reason: "tooLittle" };

  const month = latestFullMonth(lastDate, today);
  const current = months.get(month);
  // The first month only counts as "usual" if the statements cover it from (nearly) its start:
  // a statement starting on the 3rd can miss the salary paid on the 1st.
  const firstMonth = firstDate.slice(0, 7);
  const firstPartial = Number(firstDate.slice(8, 10)) > 2;
  const baseline = [...months.keys()]
    .filter((k) => k < month && !(k === firstMonth && firstPartial))
    .sort()
    .slice(-BASELINE_MONTHS);
  if (!current || baseline.length < 2) return { ok: false, reason: "tooLittle" };

  const base = baseline.map((k) => months.get(k)!);
  const usualSpend = base.reduce((s, m) => s + m.out, 0) / base.length;
  const noticeable = Math.max(usualSpend * 0.05, 1); // 5% of a normal month's spending
  const top = (entries: Evidence[]) => [...entries].sort((a, b) => b.amount - a.amount).slice(0, EVIDENCE_SHOWN);
  const found: (Insight & { weight: number })[] = [];

  // Categories that moved: by a noticeable amount and by at least a quarter of their usual.
  const categories = new Set([...current.spend.keys(), ...base.flatMap((m) => [...m.spend.keys()])]);
  for (const category of categories) {
    if (category === "Other") continue;
    const now = current.spend.get(category)?.amount ?? 0;
    const basis = baseline.map((k) => ({ month: k, amount: round2(months.get(k)!.spend.get(category)?.amount ?? 0) }));
    const usual = basis.reduce((s, b) => s + b.amount, 0) / basis.length;
    const difference = now - usual;
    if (Math.abs(difference) < noticeable || Math.abs(difference) < usual * 0.25) continue;
    if (basis.filter((b) => b.amount > 0).length === 0 && difference > 0) continue; // brand new: the payee check speaks to it
    const entries = current.spend.get(category)?.entries ?? [];
    found.push({
      kind: difference > 0 ? "categoryUp" : "categoryDown",
      category,
      month,
      amount: round2(now),
      usual: round2(usual),
      difference: round2(difference),
      basis,
      entries: top(entries),
      count: entries.length,
      weight: Math.abs(difference),
    });
  }

  // Someone new taking a real share of the month.
  const seenBefore = new Set(base.flatMap((m) => [...m.payees.keys()]));
  for (const [who, p] of current.payees) {
    if (seenBefore.has(who) || p.amount < usualSpend * 0.1) continue;
    found.push({ kind: "newPayee", payee: p.name, month, amount: round2(p.amount), entries: top(p.entries), count: p.entries.length, weight: p.amount * 0.8 });
  }

  // What was left over, and why it moved.
  const basisKept = baseline.map((k) => ({ month: k, kept: round2(months.get(k)!.in - months.get(k)!.out) }));
  const usualKept = basisKept.reduce((s, b) => s + b.kept, 0) / basisKept.length;
  const kept = current.in - current.out;
  const usualIn = base.reduce((s, m) => s + m.in, 0) / base.length;
  if (Math.abs(kept - usualKept) >= Math.max(noticeable * 2, Math.abs(usualKept) * 0.2)) {
    found.push({
      kind: kept < usualKept ? "keptLess" : "keptMore",
      month,
      kept: round2(kept),
      usualKept: round2(usualKept),
      difference: round2(kept - usualKept),
      incomeChange: round2(current.in - usualIn),
      spendingChange: round2(current.out - usualSpend),
      basis: basisKept,
      weight: Math.abs(kept - usualKept) * 1.2,
    });
  }

  const insights = found
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((f) => {
      const insight: Partial<typeof f> = { ...f };
      delete insight.weight; // only for ranking
      return insight as Insight;
    });
  return { ok: true, month, insights };
}
