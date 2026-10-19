// What comes in each month, from the statements, read according to how the
// person said they earn:
//   salaried   - the salary credit: a company (never a person) paying much the
//                same amount month after month; the biggest such payer wins.
//   freelancer - the figure they gave, checked against what the statements
//                show coming in; a big difference is pointed out, not hidden.
//   student    - no salary. Money in (pocket money, transfers) is counted as
//   none         just that, so the rest of the app can still reason about it.
// Nothing here is a tax or legal notion of income: it is money arriving in
// the accounts Horizon can see.

import { OWN_TRANSFER } from "./corrections";
import { isPersonPayment, payeeName } from "./payees";

export type IncomeKind = "salaried" | "student" | "freelancer" | "none";
export const INCOME_KINDS: IncomeKind[] = ["salaried", "student", "freelancer", "none"];
export const isIncomeKind = (value: unknown): value is IncomeKind => INCOME_KINDS.includes(value as IncomeKind);

export type SalaryCredit = { payee: string; monthly: number; months: number; last: string };
export type IncomeEstimate = {
  kind: IncomeKind;
  /** The monthly figure the rest of the app should use, when there is one. */
  monthly: number | null;
  source: "salary" | "credits" | "declared" | "none";
  /** The employer's credit, when one was found (salaried only). */
  salary?: SalaryCredit;
  /** Money in per month, averaged over the full months the statements cover (own transfers and refunds left out). */
  creditsMonthly: number;
  /** Full months behind `creditsMonthly`. */
  months: number;
  declared?: number;
  /** Freelancer: the figure given and the statements disagree by more than a third. */
  mismatch?: boolean;
  /** Salaried with a side income: the monthly figure the person gave for it, counted on top of the salary. */
  side?: number;
};

const SALARY_WORDS = /salary|\bsal\b|payroll|wages|stipend|remuneration/i;
// A narration with one of these is from a business, however short the name it leaves ("INFOSYS" alone looks like a username).
const COMPANY_WORDS =
  /\b(ltd|limited|pvt|llp|inc|corp|co|technologies|tech|solutions|services|systems|consult\w*|industries|enterprises?|associates|labs|group|global|international|india|salary|sal|payroll|wages|stipend)\b/i;
const NOT_INCOME = /refund|reversal|\brev\b|cashback|interest|\bint\b|dividend/i;
const round2 = (n: number) => Math.round(n * 100) / 100;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

type Credit = { name: string; amount: number; month: string; date: string };

/** Credits that are money arriving from outside: not moves between the person's own accounts, not refunds or interest. */
function creditsIn(transactions: Transaction[]): Credit[] {
  const out: Credit[] = [];
  for (const t of transactions) {
    const isCredit = t.type === "credit" || Number(t.amount) > 0;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!isCredit || amount === 0) continue;
    if (t.userCategory === OWN_TRANSFER) continue;
    const name = t.name ?? "";
    if (NOT_INCOME.test(name)) continue;
    const date = String(t.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ name, amount, month: date.slice(0, 7), date });
  }
  return out;
}

/**
 * The months to average over: every month with any entry, minus the first and
 * the last when there are three or more (a statement rarely starts or ends on
 * the first or last day, so those two are usually part months).
 */
function fullMonths(transactions: Transaction[]): string[] {
  const months = [...new Set(transactions.map((t) => String(t.date).slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  return months.length >= 3 ? months.slice(1, -1) : months;
}

/**
 * The salary credit, if the statements hold one: a payer that is not a person,
 * seen in at least two different months, paying within a quarter of its usual
 * amount each time. The largest such payer is taken; a payer whose narration
 * says "salary" wins over one that does not.
 */
export type SalaryHints = { prefer?: string; exclude?: string[] };

export function findSalary(transactions: Transaction[], hints: SalaryHints = {}): SalaryCredit | undefined {
  const excluded = new Set((hints.exclude ?? []).map((p) => p.toLowerCase()));
  const preferred = hints.prefer?.toLowerCase();
  const byPayee = new Map<string, Credit[]>();
  for (const c of creditsIn(transactions)) {
    // Pocket money from a parent arrives on the same date each month too: a person is never an employer.
    if (!COMPANY_WORDS.test(c.name) && isPersonPayment(c.name)) continue;
    const payee = payeeName(c.name);
    if (payee === "Other" || excluded.has(payee.toLowerCase())) continue;
    byPayee.set(payee, [...(byPayee.get(payee) ?? []), c]);
  }
  let best: (SalaryCredit & { said: boolean }) | undefined;
  for (const [payee, credits] of byPayee) {
    const months = new Set(credits.map((c) => c.month));
    // The person said this payer is the salary: it is, however uneven its months look.
    const confirmed = payee.toLowerCase() === preferred;
    if (months.size < 2 && !confirmed) continue;
    // One credit per month: a bonus paid alongside the salary would otherwise double it.
    const perMonth = [...months].map((m) => Math.max(...credits.filter((c) => c.month === m).map((c) => c.amount)));
    const usual = median(perMonth);
    if (!confirmed && !perMonth.every((a) => Math.abs(a - usual) <= usual * 0.25)) continue;
    const said = confirmed || credits.some((c) => SALARY_WORDS.test(c.name));
    const candidate = { payee, monthly: round2(usual), months: months.size, last: credits.reduce((l, c) => (c.date > l ? c.date : l), ""), said };
    if (confirmed) return { payee, monthly: candidate.monthly, months: candidate.months, last: candidate.last };
    if (!best || (candidate.said && !best.said) || (candidate.said === best.said && candidate.monthly > best.monthly)) best = candidate;
  }
  if (!best) return undefined;
  const { said: _said, ...salary } = best;
  return salary;
}

/** Money in per full month, on average. */
export function creditsPerMonth(transactions: Transaction[]): { monthly: number; months: number } {
  const months = fullMonths(transactions);
  if (months.length === 0) return { monthly: 0, months: 0 };
  const keep = new Set(months);
  const total = creditsIn(transactions)
    .filter((c) => keep.has(c.month))
    .reduce((s, c) => s + c.amount, 0);
  return { monthly: round2(total / months.length), months: months.length };
}

/** What comes in each month, read the way the person said they earn. */
export function estimateIncome(transactions: Transaction[], kind: IncomeKind, declared?: number, hints: SalaryHints = {}, side?: number): IncomeEstimate {
  const { monthly: creditsMonthly, months } = creditsPerMonth(transactions);
  const base = { kind, creditsMonthly, months };

  if (kind === "salaried") {
    const salary = findSalary(transactions, hints);
    // A side income the person named sits on top of the salary; it is their word, not the statements'.
    if (salary && side && side > 0) return { ...base, monthly: salary.monthly + side, source: "salary", salary, side };
    if (salary) return { ...base, monthly: salary.monthly, source: "salary", salary };
    return { ...base, monthly: months > 0 ? creditsMonthly : null, source: months > 0 ? "credits" : "none" };
  }

  if (kind === "freelancer") {
    if (declared && declared > 0) {
      // Two full months is the least that says anything about a freelancer's uneven income.
      const mismatch = months >= 2 && Math.abs(declared - creditsMonthly) > declared / 3;
      return { ...base, monthly: declared, source: "declared", declared, mismatch };
    }
    return { ...base, monthly: months > 0 ? creditsMonthly : null, source: months > 0 ? "credits" : "none" };
  }

  // Students and people with no income: money in is money in, never salary.
  return { ...base, monthly: months > 0 ? creditsMonthly : null, source: months > 0 ? "credits" : "none" };
}
