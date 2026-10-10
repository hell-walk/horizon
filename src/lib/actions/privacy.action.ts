"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "../server/appwrite";
import { authIdOf, getLoggedInUser, ownerIdOf } from "../server/auth";
import { getOwnBank } from "../server/banks";
import { getT } from "../i18n/server";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";
import { deleteUserEverything, exportUserData, removeBank } from "../server/userData";

// The privacy page's three actions. Every export here is a public endpoint:
// each one takes the user from the session and checks ownership itself.

export type PrivacyResult = { ok: true } | { ok: false; error: string };

/** Removes one of the signed-in user's banks, with its statements and provider links. */
export async function deleteBank(input: { appwriteItemId: string }): Promise<PrivacyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("data.errSignIn") };
  if (!allow(`privacy:bank:${ownerIdOf(user)}`, 20, 10 * MINUTE)) return { ok: false, error: t("data.errTooMany") };

  const bank = await getOwnBank(ownerIdOf(user), String(input?.appwriteItemId ?? ""));
  if (!bank) return { ok: false, error: t("data.errNotYours") };
  try {
    await removeBank(bank);
  } catch (error) {
    logError("privacy: removing a bank failed", error);
    return { ok: false, error: t("data.errFailed") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A copy of everything Horizon holds about the signed-in user, as JSON text. */
export async function exportMyData(): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("data.errSignIn") };
  if (!allow(`privacy:export:${ownerIdOf(user)}`, 5, 60 * MINUTE)) return { ok: false, error: t("data.errTooMany") };
  try {
    return { ok: true, json: JSON.stringify(await exportUserData(user), null, 2) };
  } catch (error) {
    logError("privacy: export failed", error);
    return { ok: false, error: t("data.errFailed") };
  }
}

/**
 * Deletes the signed-in user's account and data. Asks for the password again,
 * so a session left open on a shared computer is not enough.
 */
export async function deleteMyAccount(input: { password: string }): Promise<PrivacyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("data.errSignIn") };
  if (!allow(`privacy:delete:${ownerIdOf(user)}`, 5, 10 * MINUTE)) return { ok: false, error: t("data.errTooMany") };

  const password = typeof input?.password === "string" ? input.password : "";
  if (!password || password.length > 256) return { ok: false, error: t("data.errPassword") };

  // Check the password by signing in once more, then drop that extra session at once.
  try {
    const { account, user: users } = await createAdminClient();
    const check = await account.createEmailPasswordSession(user.email, password);
    await users.deleteSession(authIdOf(user), check.$id).catch(() => {});
  } catch {
    return { ok: false, error: t("data.errPassword") };
  }

  try {
    await deleteUserEverything(user);
  } catch (error) {
    logError("privacy: account deletion failed", error);
    return { ok: false, error: t("data.errFailed") };
  }

  const jar = await cookies();
  for (const name of ["banking-session", "horizon-account", "setu-consent"]) jar.delete(name);
  return { ok: true };
}
