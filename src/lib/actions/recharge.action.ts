"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";
import { OPERATOR_NAMES } from "../finance/recharges";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { rechargeDaysFor } from "../server/recharges";
import { allow, MINUTE } from "../server/rateLimit";

/** How long one recharge of this operator lasts, as the person says (1 to 400 days); 0 forgets it. */
export async function setRechargeDays({ operator, days }: { operator: string; days: number }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (!OPERATOR_NAMES.includes(operator) || !Number.isInteger(days) || days < 0 || days > 400)
    return { ok: false as const, error: t("history.editErrNothing") };
  const owner = ownerIdOf(user);
  if (!(await allow(`recharge:${owner}`, 30, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    const current = await rechargeDaysFor(owner);
    const next = { ...current };
    if (days > 0) next[operator] = days;
    else delete next[operator];
    await updatePrefs(owner, { rechargeDays: next });
    revalidatePath("/loans");
    return { ok: true as const };
  } catch (error) {
    logError("recharges: could not save the plan length", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
