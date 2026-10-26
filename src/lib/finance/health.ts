// The financial health score: one number, out of 100, from five parts that
// each have a plain explanation. Nothing is guessed: every part is a sum over
// the statements, and a part Horizon cannot work out (no income figure yet, no
// balance) is left out and the score is scaled to what is known, or withheld
// when too little is known. Not advice: a picture of where the money stands.
//
//   savings      30  what stays of the money in, over the last full months
//   emi          25  EMIs as a share of income
//   commitments  15  EMIs, rent, subscriptions and bills as a share of income
//   charges      10  bank charges in the last full months
//   cushion      20  how many months of spending the balances would cover

import { chargeKind } from "./charges";
import { OWN_TRANSFER } from "./corrections";
import type { Regular } from "./recurring";
import { spendType } from "./spending";

export type HealthKey = "savings" | "emi" | "commitments" | "charges" | "cushion";
export type HealthPart = {
  key: HealthKey;
  max: number;
  /** Points earned, or null when the part cannot be worked out yet. */
  points: number | null;
  /** The figure behind it: a share (0..1) for savings, emi and commitments; a count for charges; months for cushion. */
  value: number | null;
};
export type Health = {
  score: number | null;
  band: "good" | "fair" | "poor" | null;
  parts: HealthPart[];
  /** Full months the figures were summed over. */
  months: number;
  /** The part with the most points to gain. */
  opportunity: HealthKey | null;
};

export type HealthInput = {
  transactions: Transaction[];
  regular: Regular[];
  /** Monthly income as the person's settings and statements give it (lib/finance/income); null when unknown. */
  income: number | null;
  /** Every known balance added up; null when none is known. */
  balance: number | null;
};

export const HEALTH_MAX: Record<HealthKey, number> = { savings: 30, emi: 25, commitments: 15, charges: 10, cushion: 20 };
/** Months the flows are summed over (the latest full ones). */
const WINDOW = 3;
/** Below this much known, no score: it would be a guess. */
const MIN_KNOWN = 45;
const NOT_INCOME = /refund|reversal|\brev\b|cashback|interest|\bint\b|dividend/i;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n);
/** Points between full marks at `good` and none at `bad`, straight in between. Works for both directions. */
const scale = (value: number, good: number, bad: number, max: number) => round(max * clamp((value - bad) / (good - bad), 0, 1));

/** The latest full months with entries: the first and last month of the statements are usually part months. */
function fullMonths(transactions: Transaction[]): string[] {
  const months = [...new Set(transactions.map((t) => String(t.date).slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  const full = months.length >= 3 ? months.slice(1, -1) : months;
  return full.slice(-WINDOW);
}

export function healthScore({ transactions, regular, income, balance }: HealthInput): Health {
  const months = fullMonths(transactions);
  const keep = new Set(months);
  let moneyIn = 0;
  let spent = 0;
  let invested = 0;
  let chargeCount = 0;
  for (const t of transactions) {
    if (!keep.has(String(t.date).slice(0, 7)) || t.userCategory === OWN_TRANSFER) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    const debit = t.type === "debit" || Number(t.amount) < 0;
    if (!debit) {
      if (!NOT_INCOME.test(t.name ?? "")) moneyIn += amount;
      continue;
    }
    const kind = spendType(t);
    if (kind === "Investments") invested += amount;
    else spent += amount;
    if (kind === "Bank Fees" || chargeKind(t.name ?? "")) chargeCount++;
  }
  const n = months.length;
  const perMonth = (total: number) => (n ? total / n : 0);
  const live = regular.filter((r) => r.direction === "out" && r.status !== "stopped");
  const emiPerMonth = live.filter((r) => r.kind === "emi").reduce((s, r) => s + r.perMonth, 0);
  const committedPerMonth = live.filter((r) => ["emi", "rent", "subscription", "bill"].includes(r.kind)).reduce((s, r) => s + r.perMonth, 0);
  const monthlyIncome = income ?? (n && moneyIn > 0 ? perMonth(moneyIn) : null);

  const parts: HealthPart[] = [];
  // Savings: what stays of the money in, investments counted as kept.
  if (n > 0 && perMonth(moneyIn) > 0) {
    const rate = (perMonth(moneyIn) - perMonth(spent)) / perMonth(moneyIn);
    parts.push({ key: "savings", max: HEALTH_MAX.savings, points: scale(rate, 0.2, 0, HEALTH_MAX.savings), value: rate });
  } else parts.push({ key: "savings", max: HEALTH_MAX.savings, points: null, value: null });
  // EMIs against income: a sixth of income is comfortable, two fifths is not.
  if (monthlyIncome && monthlyIncome > 0) {
    const share = emiPerMonth / monthlyIncome;
    parts.push({ key: "emi", max: HEALTH_MAX.emi, points: scale(share, 0.15, 0.4, HEALTH_MAX.emi), value: share });
    const committed = committedPerMonth / monthlyIncome;
    parts.push({ key: "commitments", max: HEALTH_MAX.commitments, points: scale(committed, 0.5, 0.8, HEALTH_MAX.commitments), value: committed });
  } else {
    parts.push({ key: "emi", max: HEALTH_MAX.emi, points: null, value: null });
    parts.push({ key: "commitments", max: HEALTH_MAX.commitments, points: null, value: null });
  }
  // Charges: none is full marks; three or more in the window is none.
  if (n > 0) parts.push({ key: "charges", max: HEALTH_MAX.charges, points: scale(chargeCount, 0, 3, HEALTH_MAX.charges), value: chargeCount });
  else parts.push({ key: "charges", max: HEALTH_MAX.charges, points: null, value: null });
  // Cushion: three months of spending in the bank is full marks.
  if (balance !== null && n > 0 && perMonth(spent) > 0) {
    const cover = balance / perMonth(spent);
    parts.push({ key: "cushion", max: HEALTH_MAX.cushion, points: scale(cover, 3, 0, HEALTH_MAX.cushion), value: cover });
  } else parts.push({ key: "cushion", max: HEALTH_MAX.cushion, points: null, value: null });

  const known = parts.filter((p) => p.points !== null);
  const knownMax = known.reduce((s, p) => s + p.max, 0);
  const score = knownMax >= MIN_KNOWN ? round((known.reduce((s, p) => s + (p.points ?? 0), 0) / knownMax) * 100) : null;
  const band = score === null ? null : score >= 75 ? "good" : score >= 50 ? "fair" : "poor";
  const opportunity = known.length ? known.reduce((best, p) => (p.max - (p.points ?? 0) > best.max - (best.points ?? 0) ? p : best)).key : null;
  void invested; // counted as kept, by not being spent
  return { score, band, parts, months: n, opportunity: score === null ? null : opportunity };
}
