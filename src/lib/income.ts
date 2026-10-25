// What comes in each month, from the statements, read according to how the
// person said they earn:
//   salaried   - the salary credit, scored (see salaryCandidates): Horizon is
//                sure, asks, or lets the person pick it from what came in.
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
    // Statements store every amount as a positive number and say the direction in
    // `type`: the type decides. Only a row with no type falls back to the sign.
    const isCredit = t.type === "credit" || (t.type !== "debit" && Number(t.amount) > 0);
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
 * Is this credit a salary? Each payer that sends money in is scored on what a
 * careful person would look at, rather than passed or failed on one rule:
 *
 *   wording    - "salary", "sal", "payroll", "wages", "stipend", or a
 *                government pay office ("PAO", "treasury", "pay and accounts")
 *   who pays   - a company (Ltd, Pvt, LLP, Technologies...), not a person
 *   how        - a bank transfer (NEFT, RTGS, "BY TRANSFER", ACH or NACH credit)
 *   how often  - the number of months it arrived in
 *   steadiness - most months near the usual amount (not every month: a half
 *                salary in the joining month or an incentive month is normal)
 *   timing     - arriving in the same few days of each month
 *
 * Some credits are never a salary however steady they are: fund and broker
 * payouts, rent, pension, refunds and interest, and money from the person's
 * own name or own other bank. A person-named payer counts only when the
 * narration says salary (a shop owner paying by UPI); otherwise the person
 * picks that credit themselves (see the income chooser).
 *
 * Confidence: "high" needs the wording (or the person's own confirmation);
 * a steady company transfer without the wording is "medium", because rent,
 * a family firm and a retainer look exactly the same: Horizon asks. "low" is
 * not a salary without the person saying so.
 */
export type SalaryConfidence = "high" | "medium" | "low";
export type SalaryCandidate = SalaryCredit & { score: number; confidence: SalaryConfidence; said: boolean };
export type SalaryHints = { prefer?: string; exclude?: string[]; ownNames?: string[] };

const GOV_PAY = /\b(pao|cpao|pay\s*(and|&)\s*accounts?|treasury|govt\s*pay|government\s*pay|ddo|dto)\b/i;
const NOT_SALARY =
  /mutual\s*fund|\bmf\b|\bswp\b|redempt|redeem|zerodha|groww|upstox|kuvera|paytm\s*money|broking|securities|demat|\bamc\b|pension|\brent\b|rental|tenant|\blease\b|maintenance|insurance\s*claim|claim\s*settle|loan\s*disburs|disbursal|self\s*transfer|\bself\b|own\s*account/i;
const BANK_ONLY =
  /^(state\s*bank(\s*of)?(\s*india)?|sbi|hdfc(\s*bank)?|icici(\s*bank)?|axis(\s*bank)?|kotak(\s*mahindra)?(\s*bank)?|bank\s*of\s*(baroda|india|maharashtra)|punjab\s*national(\s*bank)?|pnb|canara(\s*bank)?|union\s*bank(\s*of\s*india)?|yes\s*bank|idfc(\s*first)?(\s*bank)?|indusind(\s*bank)?|bank)(\s+of)?$/i;
const BANK_RAIL = /\bneft\b|\brtgs\b|by\s*transfer|\bach\b|\bnach\b|\bimps\b|bulk\s*credit|\bbcr\b/i;
const COMPANY =
  /\b(ltd|limited|pvt|private|llp|inc|corp|corporation|technologies|tech|solutions|services|systems|consult\w*|industries|enterprises?|associates|labs|group|global|international|finserv|finance|bank|payroll|infotech|software|motors|pharma)\b/i;

// The distance between two days of the month on a 30-day circle: the 30th and the 1st are one day apart.
const dayGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 30;
  return Math.min(d, 30 - d);
};

/** Every payer that might be the salary, scored, best first. */
export function salaryCandidates(transactions: Transaction[], hints: SalaryHints = {}): SalaryCandidate[] {
  const excluded = new Set((hints.exclude ?? []).map((p) => p.toLowerCase()));
  const preferred = hints.prefer?.toLowerCase();
  const own = (hints.ownNames ?? []).map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 3);
  const byPayee = new Map<string, Credit[]>();
  for (const c of creditsIn(transactions)) {
    const payee = payeeName(c.name);
    if (payee === "Other" || excluded.has(payee.toLowerCase())) continue;
    const isPreferred = payee.toLowerCase() === preferred;
    if (!isPreferred) {
      if (NOT_SALARY.test(c.name) || GROUP_PAYEE.has(payee) || BANK_ONLY.test(payee.trim())) continue;
      const lower = c.name.toLowerCase();
      if (own.length && own.every((n) => lower.includes(n))) continue; // their own name: their own money
      // A person is never an employer unless the narration says salary.
      if (!SALARY_WORDS.test(c.name) && !GOV_PAY.test(c.name) && !COMPANY.test(c.name) && isPersonPayment(c.name)) continue;
    }
    byPayee.set(payee, [...(byPayee.get(payee) ?? []), c]);
  }

  const out: SalaryCandidate[] = [];
  for (const [payee, credits] of byPayee) {
    const monthsSeen = [...new Set(credits.map((c) => c.month))].sort();
    const confirmed = payee.toLowerCase() === preferred;
    // One credit per month: a bonus paid alongside the salary would otherwise double it.
    const perMonth = monthsSeen.map((m) => Math.max(...credits.filter((c) => c.month === m).map((c) => c.amount)));
    const usual = median(perMonth);
    // The salary as it is now: the middle of the last three months.
    const current = median(perMonth.slice(-3));
    const said = credits.some((c) => SALARY_WORDS.test(c.name) || GOV_PAY.test(c.name));
    const company = credits.some((c) => COMPANY.test(c.name));
    const rail = credits.some((c) => BANK_RAIL.test(c.name));
    const n = perMonth.length;
    const near = (band: number) => perMonth.filter((a) => Math.abs(a - usual) <= usual * band).length;
    const steady = n < 2 ? 0 : near(0.15) >= Math.ceil(n * 0.6) ? 2 : near(0.4) >= Math.ceil(n * 0.8) ? 1 : 0;
    const days = credits.map((c) => Number(c.date.slice(8, 10)));
    const midDay = median(days);
    const onTime = n >= 2 && days.filter((d) => dayGap(d, midDay) <= 5).length >= Math.ceil(days.length * 0.75) ? 1 : 0;

    let score = (said ? 3 : 0) + (company ? 1 : 0) + (rail ? 1 : 0) + (n >= 3 ? 2 : n === 2 ? 1 : 0) + steady + onTime;
    if (current < 1000) score -= 3; // cashback-sized credits are not a wage
    let confidence: SalaryConfidence;
    if (confirmed) confidence = "high";
    else if (said && score >= 6) confidence = "high";
    else if ((said && score >= 4) || (!said && steady >= 1 && n >= 2 && score >= 5)) confidence = "medium";
    else confidence = "low";
    out.push({
      payee,
      monthly: round2(current),
      months: n,
      last: credits.reduce((l, c) => (c.date > l ? c.date : l), ""),
      score: confirmed ? 99 : score,
      confidence,
      said,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.monthly - a.monthly);
}

// Payee labels that name a kind of payment rather than a payer (payees.ts aliases).
const GROUP_PAYEE = new Set(["Investments", "Rent", "Loan EMI", "ATM cash"]);

/**
 * The salary credit, if the statements hold one with at least medium
 * confidence (or the payer the person confirmed). `confidence` says whether
 * Horizon is sure ("high") or should ask ("medium").
 */
export function findSalary(transactions: Transaction[], hints: SalaryHints = {}): (SalaryCredit & { confidence: SalaryConfidence }) | undefined {
  const best = salaryCandidates(transactions, hints).find((c) => c.confidence !== "low");
  if (!best) return undefined;
  return { payee: best.payee, monthly: best.monthly, months: best.months, last: best.last, confidence: best.confidence };
}

/** Everyone who sent money in, biggest total first: the list a person picks their salary from when Horizon cannot tell. */
export function incomingPayers(transactions: Transaction[], limit = 8): { payee: string; total: number; count: number; months: number }[] {
  const by = new Map<string, Credit[]>();
  for (const c of creditsIn(transactions)) {
    const payee = payeeName(c.name);
    // What can never be a salary stays off the list: own transfers, fund payouts, rent, pension, a bare bank name.
    if (payee === "Other" || NOT_SALARY.test(c.name) || GROUP_PAYEE.has(payee) || BANK_ONLY.test(payee.trim())) continue;
    by.set(payee, [...(by.get(payee) ?? []), c]);
  }
  return [...by]
    .map(([payee, cs]) => ({ payee, total: round2(cs.reduce((s, c) => s + c.amount, 0)), count: cs.length, months: new Set(cs.map((c) => c.month)).size }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
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
