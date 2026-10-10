"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { MAX_GOALS, readGoal } from "../goals";
import { getT } from "../i18n/server";
import { authIdOf, getLoggedInUser, ownerIdOf } from "../server/auth";
import { loadGoals, storeGoals } from "../server/goals";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";

export type GoalResult = { ok: true } | { ok: false; error: string };

const thisMonth = () => new Date().toISOString().slice(0, 7);
const isId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,40}$/.test(v);
const isCurrency = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{3}$/.test(v);

/** Adds a goal, or changes one of the signed-in user's own goals (by id). */
export async function saveGoal(input: {
  id?: string;
  name: string;
  target: number;
  saved?: number;
  monthly?: number;
  by?: string;
  currency?: string;
}): Promise<GoalResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("goals.errSignIn") };
  if (!(await allow(`goals:${ownerIdOf(user)}`, 60, 10 * MINUTE))) return { ok: false, error: t("goals.errTooMany") };

  const goal = readGoal(input, thisMonth());
  if (!goal) return { ok: false, error: t("goals.errInvalid") };
  const id = input?.id;
  if (id !== undefined && !isId(id)) return { ok: false, error: t("goals.errNotFound") };
  const currency = isCurrency(input?.currency) ? input.currency : "INR";

  try {
    const goals = await loadGoals(authIdOf(user));
    if (id) {
      // Only the user's own goals can be changed: the id must be one of theirs.
      const at = goals.findIndex((g) => g.id === id);
      if (at < 0) return { ok: false, error: t("goals.errNotFound") };
      goals[at] = { id, currency: goals[at].currency, ...goal };
    } else {
      if (goals.length >= MAX_GOALS) return { ok: false, error: t("goals.errFull", { max: MAX_GOALS }) };
      goals.push({ id: `g-${randomUUID().slice(0, 12)}`, currency, ...goal });
    }
    await storeGoals(authIdOf(user), goals);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    logError("goals: could not save", error);
    return { ok: false, error: t("goals.errFailed") };
  }
}

/** Removes one of the signed-in user's own goals. */
export async function deleteGoal(input: { id: string }): Promise<GoalResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("goals.errSignIn") };
  if (!(await allow(`goals:${ownerIdOf(user)}`, 60, 10 * MINUTE))) return { ok: false, error: t("goals.errTooMany") };
  if (!isId(input?.id)) return { ok: false, error: t("goals.errNotFound") };

  try {
    const goals = await loadGoals(authIdOf(user));
    const kept = goals.filter((g) => g.id !== input.id);
    if (kept.length === goals.length) return { ok: false, error: t("goals.errNotFound") };
    await storeGoals(authIdOf(user), kept);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    logError("goals: could not delete", error);
    return { ok: false, error: t("goals.errFailed") };
  }
}
