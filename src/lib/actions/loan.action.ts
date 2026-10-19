"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { loadLoanPlans, MAX_LOAN_PLANS, readLoanPlan, type LoanPlan } from "../server/loanPlans";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { allow, MINUTE } from "../server/rateLimit";

/** Remember what the person told Horizon about a loan: the outstanding amount, the rate, and any extra they plan to pay. */
export async function saveLoanPlan({ key, plan }: { key: string; plan: LoanPlan | null }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (typeof key !== "string" || key.length === 0 || key.length > 120) return { ok: false as const, error: t("loans.planErr") };
  const clean = plan === null ? null : readLoanPlan(plan);
  if (plan !== null && !clean) return { ok: false as const, error: t("loans.planErr") };
  const owner = ownerIdOf(user);
  if (!(await allow(`loanplan:${owner}`, 30, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    const plans = { ...(await loadLoanPlans(owner)) };
    if (clean) {
      if (!(key in plans) && Object.keys(plans).length >= MAX_LOAN_PLANS) return { ok: false as const, error: t("loans.planErr") };
      plans[key] = clean;
    } else delete plans[key];
    await updatePrefs(owner, { loanPlans: plans });
    revalidatePath("/loans");
    return { ok: true as const };
  } catch (error) {
    logError("loans: could not save the plan", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
