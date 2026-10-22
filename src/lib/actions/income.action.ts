"use server";

import { revalidatePath } from "next/cache";

import { isIncomeKind } from "../income";
import { getT } from "../i18n/server";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { dayOfMonth, findEmployer, loadIncome } from "../server/income";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { allow, MINUTE } from "../server/rateLimit";

const MAX_DECLARED = 100_000_000;

/**
 * The employer Horizon can see, for someone about to say they are salaried:
 * the chooser shows it (or says none was found) before "Save" is allowed.
 */
export async function salaryCandidate(): Promise<{ ok: true; payee: string; monthly: number; months: number; payDay?: number } | { ok: false }> {
  const user = await getLoggedInUser();
  if (!user) return { ok: false };
  const owner = ownerIdOf(user);
  if (!(await allow(`income-look:${owner}`, 30, 10 * MINUTE))) return { ok: false };
  try {
    const found = await findEmployer(owner, await loadIncome(owner));
    return found ? { ok: true, payee: found.payee, monthly: found.monthly, months: found.months, payDay: dayOfMonth(found.last) } : { ok: false };
  } catch (error) {
    logError("income: could not look for the employer", error);
    return { ok: false };
  }
}

/**
 * Remember how the person earns, and for a freelancer the monthly figure they
 * gave. "Salaried" is only accepted when the statements show an employer:
 * without one Horizon could not tell which credit is the salary.
 */
export async function setIncome({ kind, declared, side, payDay }: { kind: string; declared?: number | null; side?: number | null; payDay?: number | null }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (!isIncomeKind(kind)) return { ok: false as const, error: t("auth.errorIncomeKind") };
  const figure =
    kind === "freelancer" && typeof declared === "number" && Number.isFinite(declared) && declared > 0 && declared <= MAX_DECLARED
      ? Math.round(declared)
      : undefined;
  // A side income only makes sense on top of a salary.
  const sideFigure =
    kind === "salaried" && typeof side === "number" && Number.isFinite(side) && side > 0 && side <= MAX_DECLARED ? Math.round(side) : undefined;
  const owner = ownerIdOf(user);
  if (!(await allow(`income:${owner}`, 20, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    const current = await loadIncome(owner);
    const employer = kind === "salaried" ? await findEmployer(owner, current) : undefined;
    if (kind === "salaried" && !employer) return { ok: false as const, error: t("home.incomeEmployerNone") };
    // The pay day: the day they gave, else the day the employer's last credit arrived.
    const given = typeof payDay === "number" && Number.isInteger(payDay) && payDay >= 1 && payDay <= 31 ? payDay : undefined;
    const onDay = kind === "salaried" ? (given ?? dayOfMonth(employer?.last)) : undefined;
    // The salary answers from the quick checks (this payer is / is not my salary) survive a change of kind.
    const kept = current
      ? { ...(current.salaryPayee ? { salaryPayee: current.salaryPayee } : {}), ...(current.excluded ? { excluded: current.excluded } : {}) }
      : {};
    await updatePrefs(owner, {
      income: { ...kept, kind, ...(figure ? { declared: figure } : {}), ...(sideFigure ? { side: sideFigure } : {}), ...(onDay ? { payDay: onDay } : {}) },
    });
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    logError("income: could not save how the person earns", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
