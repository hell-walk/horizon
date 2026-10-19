"use server";

import { revalidatePath } from "next/cache";

import { invalidate } from "../cache";
import { REGULAR_CHOICES } from "../checks";
import { MAX_PAYEE_RULES, MAX_ROW_CHANGES, OWN_TRANSFER, type Corrections } from "../corrections";
import { getT } from "../i18n/server";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { checksForOwner, FREE_CHECKS, loadChecksState, withAnswer } from "../server/checks";
import { loadCorrections, storeCorrections } from "../server/corrections";
import { loadIncome, type IncomeSetting } from "../server/income";
import { forgetLeftOver } from "../server/leftover";
import { logError } from "../server/log";
import { currentPlan } from "../server/plan";
import { updatePrefs } from "../server/prefs";
import { allow, MINUTE } from "../server/rateLimit";

const ANSWERS = new Set<string>(["yes", "no", "skip", ...REGULAR_CHOICES]);
const MAX_EXCLUDED = 20;

/**
 * One answer to one of Home's questions. The question is found again on the
 * server from its key, so the client sends nothing but the key and a word:
 * what the answer changes is decided here.
 */
export async function answerCheck({ key, answer }: { key: string; answer: string }) {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false as const, error: t("connect.errSignIn") };
  if (typeof key !== "string" || key.length > 200 || typeof answer !== "string" || !ANSWERS.has(answer))
    return { ok: false as const, error: t("home.checksErrGone") };
  const owner = ownerIdOf(user);
  if (!(await allow(`checks:${owner}`, 60, 10 * MINUTE))) return { ok: false as const, error: t("connect.cardTooMany") };

  try {
    const [plan, state] = await Promise.all([currentPlan(), loadChecksState(owner)]);
    if (plan?.kind !== "subscribed" && state.used >= FREE_CHECKS) return { ok: false as const, error: t("home.checksErrLocked") };
    const check = (await checksForOwner(owner, { firstName: user.firstName, lastName: user.lastName })).find((c) => c.key === key);
    if (!check) return { ok: false as const, error: t("home.checksErrGone") };

    const corrections: Corrections = await loadCorrections(owner);
    let changed = false;
    let income: Partial<IncomeSetting> | null = null;
    const setRow = (id: string) => {
      if (!(id in corrections.rows) && Object.keys(corrections.rows).length >= MAX_ROW_CHANGES) throw new Error("row changes full");
      corrections.rows[id] = { category: OWN_TRANSFER };
      changed = true;
    };
    const setPayee = (payeeKey: string, category: string) => {
      if (!(payeeKey in corrections.payees) && Object.keys(corrections.payees).length >= MAX_PAYEE_RULES) throw new Error("payee rules full");
      corrections.payees[payeeKey] = { ...corrections.payees[payeeKey], category };
      changed = true;
    };

    if (check.kind === "ownPair" && answer === "yes") {
      setRow(check.from.txId);
      setRow(check.to.txId);
    } else if (check.kind === "ownCredit" && answer === "yes") {
      setPayee(check.payeeKey, OWN_TRANSFER);
    } else if (check.kind === "salary" && answer === "yes") {
      income = { salaryPayee: check.payee };
    } else if (check.kind === "salary" && answer === "no") {
      const current = await loadIncome(owner);
      income = { excluded: [...(current?.excluded ?? []).filter((p) => p !== check.payee), check.payee].slice(-MAX_EXCLUDED) };
    } else if (check.kind === "regularKind" && (REGULAR_CHOICES as readonly string[]).includes(answer)) {
      setPayee(check.payeeKey, answer);
    }

    if (changed) {
      await storeCorrections(owner, corrections);
      invalidate("banks:leftover:");
      await forgetLeftOver(owner);
    }
    if (income) {
      const current = await loadIncome(owner);
      if (current) await updatePrefs(owner, { income: { ...current, ...income } });
    }
    await updatePrefs(owner, { checks: withAnswer(state, key) });
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    logError("checks: could not save an answer", error);
    return { ok: false as const, error: t("connect.cardSaveFailed") };
  }
}
