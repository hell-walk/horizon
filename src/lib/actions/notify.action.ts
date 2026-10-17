"use server";

import { getLocale, getT } from "../i18n/server";
import { readPushSubscription, withDevice, isPushEndpoint } from "../notify";
import { getLoggedInUser, ownerIdOf } from "../server/auth";
import { logError } from "../server/log";
import { deliver, emailConfigured, loadNotify, messageFor, pushConfigured, saveNotify } from "../server/notify";
import { allow, MINUTE } from "../server/rateLimit";
import { signatureMatches } from "../server/crypto";

// Reminder settings. Every export here is a public endpoint: each one takes
// the person from the session (or, for unsubscribing, a signed link) and
// changes only their own settings.

export type NotifyResult = { ok: true } | { ok: false; error: string };

/** Turns push reminders on for this browser (the subscription the browser made). */
export async function savePushDevice(input: { subscription: unknown }): Promise<NotifyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("remind.errSignIn") };
  if (!pushConfigured()) return { ok: false, error: t("remind.errOff") };
  if (!(await allow(`notify:device:${ownerIdOf(user)}`, 10, 10 * MINUTE))) return { ok: false, error: t("remind.errTooMany") };
  const sub = readPushSubscription(input?.subscription);
  if (!sub) return { ok: false, error: t("remind.errDevice") };
  try {
    const settings = await loadNotify(ownerIdOf(user));
    await saveNotify(ownerIdOf(user), { ...withDevice(settings, sub), locale: await getLocale() });
    return { ok: true };
  } catch (error) {
    logError("notify: saving a device failed", error);
    return { ok: false, error: t("remind.errFailed") };
  }
}

/** Turns push reminders off for this browser. */
export async function removePushDevice(input: { endpoint: unknown }): Promise<NotifyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("remind.errSignIn") };
  if (!(await allow(`notify:device:${ownerIdOf(user)}`, 10, 10 * MINUTE))) return { ok: false, error: t("remind.errTooMany") };
  if (!isPushEndpoint(input?.endpoint)) return { ok: false, error: t("remind.errDevice") };
  try {
    const settings = await loadNotify(ownerIdOf(user));
    await saveNotify(ownerIdOf(user), { ...settings, push: settings.push.filter((p) => p.endpoint !== input.endpoint) });
    return { ok: true };
  } catch (error) {
    logError("notify: removing a device failed", error);
    return { ok: false, error: t("remind.errFailed") };
  }
}

/** Email reminders on or off. */
export async function setEmailReminders(input: { on: unknown }): Promise<NotifyResult> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("remind.errSignIn") };
  if (input?.on === true && !emailConfigured()) return { ok: false, error: t("remind.errOff") };
  if (!(await allow(`notify:email:${ownerIdOf(user)}`, 10, 10 * MINUTE))) return { ok: false, error: t("remind.errTooMany") };
  try {
    const settings = await loadNotify(ownerIdOf(user));
    await saveNotify(ownerIdOf(user), { ...settings, email: input?.on === true, locale: await getLocale() });
    return { ok: true };
  } catch (error) {
    logError("notify: email setting failed", error);
    return { ok: false, error: t("remind.errFailed") };
  }
}

/** Sends one test reminder on every channel that is on, so people see what they will get. */
export async function sendTestReminder(): Promise<{ ok: true; push: number; email: boolean } | { ok: false; error: string }> {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("remind.errSignIn") };
  if (!(await allow(`notify:test:${ownerIdOf(user)}`, 3, 60 * MINUTE))) return { ok: false, error: t("remind.errTooMany") };
  try {
    const settings = { ...(await loadNotify(ownerIdOf(user))), locale: await getLocale() };
    if (!settings.email && settings.push.length === 0) return { ok: false, error: t("remind.errNothingOn") };
    const result = await deliver(ownerIdOf(user), user.email, settings, messageFor("test", 1, settings));
    return { ok: true, push: result.push, email: result.email };
  } catch (error) {
    logError("notify: test failed", error);
    return { ok: false, error: t("remind.errFailed") };
  }
}

/** Turns email reminders off from the link in an email: no sign-in, a signed link instead. */
export async function unsubscribeEmail(input: { u: unknown; t: unknown }): Promise<NotifyResult> {
  const t = await getT();
  const ownerId = typeof input?.u === "string" ? input.u : "";
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(ownerId) || !signatureMatches("unsubscribe", ownerId, String(input?.t ?? ""))) {
    return { ok: false, error: t("remind.errLink") };
  }
  if (!(await allow(`notify:unsubscribe:${ownerId}`, 10, 10 * MINUTE))) return { ok: false, error: t("remind.errTooMany") };
  try {
    const settings = await loadNotify(ownerId);
    if (settings.email) await saveNotify(ownerId, { ...settings, email: false });
    return { ok: true };
  } catch (error) {
    logError("notify: unsubscribe failed", error);
    return { ok: false, error: t("remind.errFailed") };
  }
}
