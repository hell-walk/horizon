"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";
import { OPERATOR_NAMES, rechargeDaysKey } from "../finance/recharges";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { logError } from "../server/log";
import { updatePrefs } from "../server/prefs";
import { rechargeDaysFor } from "../server/recharges";
import { allow, MINUTE } from "../server/rateLimit";

/** How long the plan at this price lasts with this operator, as the person says (1 to 400 days); 0 forgets it. */
export async function setRechargeDays({ operator, price, days }: { operator: string; price: number; days: number }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (!OPERATOR_NAMES.includes(operator) || !Number.isFinite(price) || price < 1 || price > 100_000 || !Number.isInteger(days) || days < 0 || days > 400)
    return { ok: false as const, error: t("history.editErrNothing") };
  const owner = ownerIdOf(user);
  if (!(await allow(`recharge:${owner}`, 30, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };
  try {
    const current = await rechargeDaysFor(owner);
    const next = { ...current };
    // Said for this plan now: a length saved for the operator alone (before plans had their own) gives way.
    delete next[operator];
    if (days > 0) next[rechargeDaysKey(operator, price)] = days;
    else delete next[rechargeDaysKey(operator, price)];
    await updatePrefs(owner, { rechargeDays: next });
    revalidatePath("/recharges");
    return { ok: true as const };
  } catch (error) {
    logError("recharges: could not save the plan length", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
