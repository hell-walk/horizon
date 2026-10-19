"use server";

import { revalidatePath } from "next/cache";

import { isIncomeKind } from "../income";
import { getT } from "../i18n/server";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { allow, MINUTE } from "../server/rateLimit";

const MAX_DECLARED = 100_000_000;

/** Remember how the person earns, and for a freelancer the monthly figure they gave. */
export async function setIncome({ kind, declared, side }: { kind: string; declared?: number | null; side?: number | null }) {
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
  if (!(await allow(`income:${ownerIdOf(user)}`, 20, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    await updatePrefs(ownerIdOf(user), { income: { kind, ...(figure ? { declared: figure } : {}), ...(sideFigure ? { side: sideFigure } : {}) } });
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    logError("income: could not save how the person earns", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
