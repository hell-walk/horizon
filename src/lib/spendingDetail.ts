import { OWN_TRANSFER } from "./corrections";
import { lenderOf } from "./loans";
import { isPersonPayment, payeeName, PEOPLE_GROUP } from "./payees";
import { spendType } from "./spending";

// One kind of spending, looked at closely: the page a slice of the Home chart
// opens for subscribers. Everything here is worked out from one account's
// entries, the same buckets as the chart (spending.ts), so the numbers match.

/** A spending bucket's name as it sits in a URL: "UPI payments" is "upi-payments". */
export const spendSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type DetailEntry = { id: string; date: string; name: string; amount: number };
export type DetailSlice = { name: string; amount: number; count: number; share: number };

export type SpendingDetail = {
  /** The bucket's English name ("UPI payments"); translated where shown. */
  name: string;
  total: number;
  count: number;
  average: number;
  /** Share of everything spent from the account in the same window. */
  share: number;
  allSpent: number;
  from: string;
  to: string;
  /** Who the money went to: the largest six, the rest (and unreadable payees) as one slice named "Other". */
  payees: DetailSlice[];
  /** Month by month, oldest first, the last six months the statements cover. */
  months: { month: string; amount: number; count: number }[];
  /** The latest month next to the average of the months before it (when there are two or more). */
  compare: { month: string; amount: number; usual: number; difference: number } | null;
  /** Spent on each day of the week, Monday first. */
  weekdays: number[];
  biggest: DetailEntry[];
  entries: DetailEntry[];
  /** UPI only: money to people and to shops. */
  upi: { people: { amount: number; count: number }; shops: { amount: number; count: number } } | null;
};

const WINDOW_DAYS = 365;
const DAY = 86_400_000;
const PAYEES_SHOWN = 6;
const MONTHS_SHOWN = 6;
const ENTRIES_SHOWN = 200;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isDebit = (t: Pick<Transaction, "type" | "amount">) => t.type === "debit" || (t.type !== "credit" && Number(t.amount) < 0);

/** Every debit in the bucket a slug names, over the last 12 months the entries cover; null when the slug is no bucket there. */
export function spendingDetail(transactions: Transaction[], slug: string): SpendingDetail | null {
  const dated = transactions.filter((t) => /^\d{4}-\d{2}-\d{2}/.test(t.date ?? ""));
  if (dated.length === 0) return null;
  const to = dated.reduce((last, t) => (t.date > last ? t.date : last), "").slice(0, 10);
  const start = new Date(Date.parse(to) - WINDOW_DAYS * DAY).toISOString().slice(0, 10);

  let name: string | null = null;
  let allSpent = 0;
  const rows: (DetailEntry & { tx: Transaction })[] = [];
  for (const t of dated) {
    const date = t.date.slice(0, 10);
    const amount = Math.abs(Number(t.amount) || 0);
    if (date <= start || !amount || !isDebit(t)) continue;
    const type = spendType(t);
    if (type === OWN_TRANSFER) continue; // moving money between your own accounts is not spending
    allSpent += amount;
    if (spendSlug(type) !== slug) continue;
    name = type;
    rows.push({ id: t.id, date, name: t.name, amount, tx: t });
  }
  if (!name) return null;

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const from = rows.reduce((first, r) => (r.date < first ? r.date : first), to);

  const byPayee = new Map<string, DetailSlice>();
  for (const r of rows) {
    // Loans by lender ("HDFC Bank", not the generic "Loan EMI").
    const who = r.tx.shownName || (name === "EMI & pay later" ? lenderOf(r.name)?.name : undefined) || payeeName(r.name);
    const slice = byPayee.get(who) ?? { name: who, amount: 0, count: 0, share: 0 };
    slice.amount += r.amount;
    slice.count++;
    byPayee.set(who, slice);
  }
  const sorted = [...byPayee.values()].filter((p) => p.name !== "Other").sort((a, b) => b.amount - a.amount);
  const head = sorted.slice(0, PAYEES_SHOWN);
  const rest = [...sorted.slice(PAYEES_SHOWN), ...(byPayee.has("Other") ? [byPayee.get("Other")!] : [])];
  if (rest.length) head.push({ name: "Other", amount: rest.reduce((s, p) => s + p.amount, 0), count: rest.reduce((s, p) => s + p.count, 0), share: 0 });
  const payees = head.map((p) => ({ ...p, amount: round2(p.amount), share: total ? p.amount / total : 0 }));

  // The last six calendar months the statements cover (any entry at all), empty ones for this kind included.
  // A month before the first statement is unknown, not zero, so it is left out.
  const monthKeys: string[] = [];
  const [ty, tm] = to.split("-").map(Number);
  for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    if (key >= start.slice(0, 7)) monthKeys.push(key);
  }
  const months = monthKeys
    .filter((month) => dated.some((t) => t.date.startsWith(month)))
    .map((month) => {
      const inMonth = rows.filter((r) => r.date.startsWith(month));
      return { month, amount: round2(inMonth.reduce((s, r) => s + r.amount, 0)), count: inMonth.length };
    });

  // Compare the latest FULL month: statements ending on the 12th show a third of a month.
  const covered = Number(to.slice(8, 10)) >= 25 ? months : months.slice(0, -1);
  const latest = covered[covered.length - 1];
  const before = covered.slice(0, -1).slice(-3);
  const usual = before.length >= 2 ? before.reduce((s, m) => s + m.amount, 0) / before.length : null;
  const compare =
    latest && usual !== null ? { month: latest.month, amount: latest.amount, usual: round2(usual), difference: round2(latest.amount - usual) } : null;

  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) weekdays[(new Date(`${r.date}T00:00:00Z`).getUTCDay() + 6) % 7] += r.amount;

  const entries = rows
    .map((r) => ({ id: r.id, date: r.date, name: r.name, amount: round2(r.amount) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);

  let upi: SpendingDetail["upi"] = null;
  if (name === PEOPLE_GROUP) {
    upi = { people: { amount: 0, count: 0 }, shops: { amount: 0, count: 0 } };
    for (const r of rows) {
      const side = isPersonPayment(r.name) ? upi.people : upi.shops;
      side.amount = round2(side.amount + r.amount);
      side.count++;
    }
  }

  return {
    name,
    total: round2(total),
    count: rows.length,
    average: round2(total / rows.length),
    share: allSpent ? total / allSpent : 0,
    allSpent: round2(allSpent),
    from,
    to,
    payees,
    months,
    compare,
    weekdays: weekdays.map(round2),
    biggest: [...entries].sort((a, b) => b.amount - a.amount).slice(0, 5),
    entries: entries.slice(0, ENTRIES_SHOWN),
    upi,
  };
}
