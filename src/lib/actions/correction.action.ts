"use server";

import { revalidatePath } from "next/cache";

import { invalidate } from "../cache";

import { cleanName, isCategory, MAX_PAYEE_RULES, MAX_ROW_CHANGES, payeeKey, type Correction } from "../corrections";
import { getT } from "../i18n/server";
import { getAccountUncached } from "../server/accounts";
import { authIdOf, getLoggedInUser, ownerIdOf } from "../server/auth";
import { loadCorrections, storeCorrections } from "../server/corrections";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";

export type CorrectionResult = { ok: true } | { ok: false; error: string };

type Target = { accountId: string; transactionId: string };

const isTarget = (input: unknown): input is Target => {
  const v = input as Record<string, unknown> | null;
  return !!v && typeof v.accountId === "string" && typeof v.transactionId === "string" && v.accountId.length <= 64 && v.transactionId.length <= 200;
};

/**
 * Finds the entry on one of the signed-in user's own accounts. The account
 * loader only returns accounts the user owns, so a forged account id finds
 * nothing. Uncached, so the page drawn after the change is not given this
 * copy from before it.
 */
async function findEntry(target: Target) {
  const account = await getAccountUncached({ appwriteItemId: target.accountId });
  return (account?.transactions as Transaction[] | undefined)?.find((tx) => tx.id === target.transactionId) ?? null;
}

/**
 * Gives an entry a clearer name and/or a category, for this entry only or
 * for every entry with the same payee. The bank's own record is not changed.
 */
export async function correctTransaction(input: Target & { name?: string; category?: string; everyPayment?: boolean }): Promise<CorrectionResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("history.editErrSignIn") };
  if (!isTarget(input)) return { ok: false, error: t("history.editErrNotFound") };
  if (!allow(`corrections:${ownerIdOf(user)}`, 60, 10 * MINUTE)) return { ok: false, error: t("history.editErrTooMany") };

  const name = input.name === undefined || input.name === "" ? null : cleanName(input.name);
  if (input.name && !name) return { ok: false, error: t("history.editErrNothing") };
  const category = input.category === undefined || input.category === "" ? null : input.category;
  if (category !== null && !isCategory(category)) return { ok: false, error: t("history.editErrCategory") };
  if (!name && !category) return { ok: false, error: t("history.editErrNothing") };

  try {
    const entry = await findEntry(input);
    if (!entry) return { ok: false, error: t("history.editErrNotFound") };

    const change: Correction = { ...(name ? { name } : {}), ...(category ? { category } : {}) };
    const corrections = await loadCorrections(authIdOf(user));
    const key = payeeKey(entry.name);
    // No readable payee (only codes and numbers): the change can only be for this entry.
    if (input.everyPayment === true && key) {
      if (!(key in corrections.payees) && Object.keys(corrections.payees).length >= MAX_PAYEE_RULES) {
        return { ok: false, error: t("history.editErrFull", { max: MAX_PAYEE_RULES }) };
      }
      corrections.payees[key] = change;
      delete corrections.rows[entry.id]; // the payee-wide change should show on this entry too
    } else {
      if (!(entry.id in corrections.rows) && Object.keys(corrections.rows).length >= MAX_ROW_CHANGES) {
        return { ok: false, error: t("history.editErrFull", { max: MAX_ROW_CHANGES }) };
      }
      corrections.rows[entry.id] = change;
    }
    await storeCorrections(authIdOf(user), corrections);
    invalidate("banks:leftover:");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    logError("corrections: could not save", error);
    return { ok: false, error: t("history.editErrFailed") };
  }
}

/** Removes the user's changes to this entry and to its payee: it shows as the bank sent it again. */
export async function undoCorrection(input: Target): Promise<CorrectionResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("history.editErrSignIn") };
  if (!isTarget(input)) return { ok: false, error: t("history.editErrNotFound") };
  if (!allow(`corrections:${ownerIdOf(user)}`, 60, 10 * MINUTE)) return { ok: false, error: t("history.editErrTooMany") };

  try {
    const entry = await findEntry(input);
    if (!entry) return { ok: false, error: t("history.editErrNotFound") };

    const corrections = await loadCorrections(authIdOf(user));
    delete corrections.rows[entry.id];
    const key = payeeKey(entry.name);
    if (key) delete corrections.payees[key];
    await storeCorrections(authIdOf(user), corrections);
    invalidate("banks:leftover:");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    logError("corrections: could not undo", error);
    return { ok: false, error: t("history.editErrFailed") };
  }
}
