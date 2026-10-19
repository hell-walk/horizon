import "server-only";

import { cache } from "react";

import type { LoanPlan } from "../payoff";
import { readPrefs } from "./prefs";

export type { LoanPlan };

export const MAX_LOAN_PLANS = 40;
const positive = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : undefined);

/** One plan, read defensively; null when the figures are not usable. */
export function readLoanPlan(value: unknown): LoanPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const outstanding = positive(v.outstanding, 1e9);
  const annualRate = typeof v.annualRate === "number" && Number.isFinite(v.annualRate) && v.annualRate >= 0 && v.annualRate <= 60 ? v.annualRate : undefined;
  if (outstanding === undefined || annualRate === undefined) return null;
  const extraMonthly = positive(v.extraMonthly, 1e8);
  const lumpSum = positive(v.lumpSum, 1e9);
  return { outstanding, annualRate, ...(extraMonthly ? { extraMonthly } : {}), ...(lumpSum ? { lumpSum } : {}) };
}

/** The saved plans, by the loan's key (lib/loans). */
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
