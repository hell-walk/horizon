"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getLoggedInUser, loadSession, ownerIdOf } from "../server/auth";
import { getOwnBank } from "../server/banks";
import { getT } from "../i18n/server";
import { logError } from "../server/log";
import { allow, MINUTE } from "../server/rateLimit";
import { clearSessionCookies, passwordMatches } from "../server/supabase";
import { deleteUserEverything, exportUserData, removeBank } from "../server/userData";

// The privacy page's three actions. Every export here is a public endpoint:
// each one takes the user from the session and checks ownership itself.

export type PrivacyResult = { ok: true } | { ok: false; error: string };

/** Removes one of the signed-in user's banks, with its statements and provider links. */
export async function deleteBank(input: { appwriteItemId: string }): Promise<PrivacyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("data.errSignIn") };
  if (!(await allow(`privacy:bank:${ownerIdOf(user)}`, 20, 10 * MINUTE))) return { ok: false, error: t("data.errTooMany") };

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
  if (!(await allow(`privacy:export:${ownerIdOf(user)}`, 5, 60 * MINUTE))) return { ok: false, error: t("data.errTooMany") };
  try {
    return { ok: true, json: JSON.stringify(await exportUserData(user), null, 2) };
  } catch (error) {
    logError("privacy: export failed", error);
    return { ok: false, error: t("data.errFailed") };
  }
}

// A Google login has no password to ask for: it types its email instead,
// within this long of signing in.
const RECENT_SIGN_IN = 15 * MINUTE;

/**
 * Deletes the signed-in user's account and data. Asks for the password again
 * (or, for a Google login, the email and a fresh sign-in), so a session left
 * open on a shared computer is not enough.
 */
export async function deleteMyAccount(input: { password?: string; email?: string }): Promise<PrivacyResult> {
  const t = await getT();
  const [user, session] = await Promise.all([getLoggedInUser(), loadSession()]);
  if (!user || !session) return { ok: false, error: t("data.errSignIn") };
  if (!(await allow(`privacy:delete:${ownerIdOf(user)}`, 5, 10 * MINUTE))) return { ok: false, error: t("data.errTooMany") };

  if (session.hasPassword) {
    const password = typeof input?.password === "string" ? input.password : "";
    if (!password || password.length > 256 || !(await passwordMatches(session.email, password))) return { ok: false, error: t("data.errPassword") };
  } else {
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email !== session.email.toLowerCase()) return { ok: false, error: t("data.errEmail") };
    if (Date.now() - session.lastSignInAt > RECENT_SIGN_IN) return { ok: false, error: t("data.errRecentSignIn") };
  }

  try {
    await deleteUserEverything(user);
  } catch (error) {
    logError("privacy: account deletion failed", error);
    return { ok: false, error: t("data.errFailed") };
  }

  await clearSessionCookies();
  const jar = await cookies();
  for (const name of ["horizon-account", "setu-consent"]) jar.delete(name);
  return { ok: true };
}
