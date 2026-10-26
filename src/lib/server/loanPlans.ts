import "server-only";

import { cache } from "react";

import type { LoanPlan } from "../finance/payoff";
import { readPrefs } from "./prefs";

export type { LoanPlan };

export const MAX_LOAN_PLANS = 40;
const positive = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : undefined);

/** One plan, read defensively; null when nothing in it is usable. */
export function readLoanPlan(value: unknown): LoanPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const plan: LoanPlan = {};
  const outstanding = positive(v.outstanding, 1e9);
  if (outstanding) plan.outstanding = outstanding;
  if (typeof v.annualRate === "number" && Number.isFinite(v.annualRate) && v.annualRate >= 0 && v.annualRate <= 60) plan.annualRate = v.annualRate;
  const extraMonthly = positive(v.extraMonthly, 1e8);
  if (extraMonthly) plan.extraMonthly = extraMonthly;
  const lumpSum = positive(v.lumpSum, 1e9);
  if (lumpSum) plan.lumpSum = lumpSum;
  const emi = positive(v.emi, 1e8);
  if (emi) plan.emi = emi;
  if (typeof v.borrowed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.borrowed) && !Number.isNaN(Date.parse(v.borrowed))) plan.borrowed = v.borrowed;
  if (typeof v.tenure === "number" && Number.isInteger(v.tenure) && v.tenure >= 1 && v.tenure <= 360) plan.tenure = v.tenure;
  if (typeof v.dueDay === "number" && Number.isInteger(v.dueDay) && v.dueDay >= 1 && v.dueDay <= 31) plan.dueDay = v.dueDay;
  // Worth keeping when it says what the loan costs, or when it ends.
  const usable = plan.outstanding !== undefined || (plan.borrowed !== undefined && plan.tenure !== undefined) || plan.dueDay !== undefined;
  return usable ? plan : null;
}

/** The saved plans, by the loan's key (lib/finance/loans). */
export const loadLoanPlans = cache(async (ownerId: string): Promise<Record<string, LoanPlan>> => {
  const raw = (await readPrefs(ownerId)).loanPlans;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, LoanPlan> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_LOAN_PLANS)) {
    const plan = readLoanPlan(value);
    if (plan && key.length <= 120) out[key] = plan;
  }
  return out;
});
