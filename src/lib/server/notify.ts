import "server-only";

import { Query } from "node-appwrite";
import webpush from "web-push";

import { applyCorrections } from "../corrections";
import { headsUp, type HeadsUpInput, type HeadsUpResult } from "../headsUp";
import { makeTranslator } from "../i18n/translate";
import { markSent, readNotify, reminderFor, type NotifySettings, type PushSubscription, type Reminder, type ReminderKind, uploadReminder } from "../notify";
import { mapWithLimit } from "../parallel";
import { getStatementTransactions, MANUAL_PROVIDER, toManualAccount } from "../providers/manual";
import { findRegular } from "../recurring";
import { siteUrl } from "../site";
import { createAdminClient } from "./appwrite";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";
import { signFor } from "./crypto";
import { logError } from "./log";
import { readPrefs, updatePrefs } from "./prefs";
import { reportForOwner } from "./report";
import { LOCALE_TAGS } from "../i18n/config";
import { formatAmount } from "../utils";
import { claim } from "./shared";

// Sends reminders: web push to the person's devices and email through Brevo.
// Runs once a day from /api/cron/reminders, and once on demand for "Send a
// test". Works without a session (the cron has none): it reads a person's
// banks and statements by their profile id.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID } = process.env;

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const emailConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.REMINDER_FROM_EMAIL);

export async function loadNotify(ownerId: string): Promise<NotifySettings> {
  return readNotify((await readPrefs(ownerId)).notify);
}

export async function saveNotify(ownerId: string, settings: NotifySettings) {
  await updatePrefs(ownerId, { notify: settings });
}

/** "Be prepared" for one person, from their profile id alone. */
export async function headsUpForOwner(ownerId: string, today = new Date()): Promise<HeadsUpResult & { latest: string | null }> {
  const [banks, corrections] = await Promise.all([getBanks({ userId: ownerId }), loadCorrections(ownerId)]);
  const inputs: HeadsUpInput[] = await Promise.all(
    banks
      .filter((bank) => bank.provider === MANUAL_PROVIDER)
      .map(async (bank) => {
        const account = toManualAccount(bank);
        const transactions = applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[];
        return {
          account: { id: bank.$id, name: account.name, mask: account.mask, currency: account.currency },
          balance: account.balanceUnknown ? null : account.currentBalance,
          transactions,
          regular: findRegular(transactions, today),
        };
      }),
  );
  // The newest entry saved anywhere: how long the statements have been waiting for a newer one.
  const latest =
    inputs
      .flatMap((i) => i.transactions.map((t) => String(t.date).slice(0, 10)))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .at(-1) ?? null;
  return { ...headsUp(inputs, today), latest };
}

type Message = { title: string; body: string; url: string };

/** What a reminder says, in the person's language. Short, with no amounts or bank names. */
export function messageFor(kind: ReminderKind | "test", count: number, settings: NotifySettings): Message {
  const t = makeTranslator(settings.locale);
  return { title: t(`remind.${kind}Title`), body: t(`remind.${kind}Body`, { count }), url: kind === "upload" ? "/upload-statement" : "/" };
}

/** Sends to every device; drops the ones the push service says are gone. Returns the devices still valid and how many got it. */
async function sendPush(devices: PushSubscription[], message: Message): Promise<{ kept: PushSubscription[]; delivered: number }> {
  if (!pushConfigured() || devices.length === 0) return { kept: devices, delivered: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@lazyistudio.in",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url });
  const kept: PushSubscription[] = [];
  let delivered = 0;
  for (const device of devices) {
    try {
      await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, { TTL: 12 * 60 * 60, urgency: "normal", timeout: 10_000 });
      kept.push(device);
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) continue; // unsubscribed in the browser, or the browser is gone
      kept.push(device);
      logError("notify: push failed", error);
    }
  }
  return { kept, delivered };
}

/**
 * The address that turns email reminders off without signing in (signed, so
 * nobody can do it for someone else): the page with a button for people, the
 * API for mail apps' one-click unsubscribe (they POST to it).
 */
export function unsubscribeUrl(ownerId: string, kind: "page" | "oneClick" = "page"): string | null {
  const signature = signFor("unsubscribe", ownerId);
  const path = kind === "page" ? "/unsubscribe" : "/api/unsubscribe";
  return signature ? `${siteUrl()}${path}?u=${encodeURIComponent(ownerId)}&t=${signature}` : null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One email through Brevo's transactional API. */
async function sendEmail(to: string, ownerId: string, message: Message, settings: NotifySettings): Promise<boolean> {
  if (!emailConfigured() || !to) return false;
  const t = makeTranslator(settings.locale);
  const open = `${siteUrl()}${message.url}`;
  const stop = unsubscribeUrl(ownerId);
  const oneClick = unsubscribeUrl(ownerId, "oneClick");
  const text = [message.body, "", `${t("remind.emailOpen")}: ${open}`, "", t("remind.emailWhy"), stop ? `${t("remind.emailStop")}: ${stop}` : ""].join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;line-height:1.5;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#666;margin:0 0 12px">Horizon</p>
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(message.title)}</h1>
<p style="font-size:15px;margin:0 0 20px">${escapeHtml(message.body)}</p>
<p style="margin:0 0 28px"><a href="${escapeHtml(open)}" style="background:#C7EF00;color:#111;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:6px;display:inline-block">${escapeHtml(t("remind.emailOpen"))}</a></p>
<p style="font-size:12px;color:#666;margin:0">${escapeHtml(t("remind.emailWhy"))}${stop ? ` <a href="${escapeHtml(stop)}" style="color:#666">${escapeHtml(t("remind.emailStop"))}</a>` : ""}</p>
</body></html>`;
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.REMINDER_FROM_EMAIL, name: process.env.REMINDER_FROM_NAME || "Horizon" },
        // The sender can be an address nobody reads (on the domain Brevo authenticated); replies go here instead.
        ...(process.env.REMINDER_REPLY_TO ? { replyTo: { email: process.env.REMINDER_REPLY_TO } } : {}),
        to: [{ email: to }],
        subject: message.title,
        textContent: text,
        htmlContent: html,
        ...(oneClick ? { headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      logError("notify: Brevo refused the email", new Error(`${response.status} ${(await response.text()).slice(0, 200)}`));
      return false;
    }
    return true;
  } catch (error) {
    logError("notify: email failed", error);
    return false;
  }
}

/** Sends one message on every channel the person turned on, and stores what changed. */
export async function deliver(ownerId: string, email: string, settings: NotifySettings, message: Message, sentKeys: string[] = []) {
  const push = await sendPush(settings.push, message);
  const mailed = settings.email ? await sendEmail(email, ownerId, message, settings) : false;
  const delivered = push.delivered > 0 || mailed;
  const next: NotifySettings = { ...settings, push: push.kept, sent: delivered ? markSent(settings.sent, sentKeys) : settings.sent };
  if (next.push.length !== settings.push.length || next.sent !== settings.sent) await saveNotify(ownerId, next);
  return { push: push.delivered, email: mailed };
}

export type RunStats = { people: number; reminded: number; push: number; email: number; failed: number; reports?: number };

/**
 * The 1st of the month: the previous month's report by email, to everyone with
 * email reminders on who has not switched the report off. Once per month each.
 */
export async function runMonthlyReports(today = new Date()): Promise<number> {
  if (today.getUTCDate() !== 1 || !emailConfigured()) return 0;
  const { database } = await createAdminClient();
  let sent = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await database.listDocuments(DATABASE_ID!, USER_COLLECTION_ID!, [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    const people = (page.documents as unknown as { $id: string; email?: string; prefs?: string }[])
      .filter((doc) => doc.prefs?.includes('"notify"') && doc.email)
      .map((doc) => {
        try {
          return { id: doc.$id, email: doc.email!, settings: readNotify(JSON.parse(doc.prefs!).notify) };
        } catch {
          return null;
        }
      })
      .filter((p): p is { id: string; email: string; settings: NotifySettings } => p !== null && p.settings.email && p.settings.monthly);
    await mapWithLimit(people, 4, async (person) => {
      try {
        const { report, currency } = await reportForOwner(person.id);
        if (!report) return;
        const key = `report:${report.month}`;
        if (person.settings.sent.includes(key)) return;
        const t = makeTranslator(person.settings.locale);
        const month = new Intl.DateTimeFormat(LOCALE_TAGS[person.settings.locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(
          new Date(`${report.month}-01T00:00:00Z`),
        );
        const money = (n: number) => formatAmount(Math.round(n), currency);
        const message: Message = {
          title: t("report.emailTitle", { month }),
          body: t("report.emailBody", { month, in: money(report.moneyIn), out: money(report.spent), kept: money(report.kept) }),
          url: `/report?month=${report.month}`,
        };
        const result = await deliver(person.id, person.email, { ...person.settings, push: [] }, message, [key]);
        if (result.email) sent++;
      } catch (error) {
        logError("notify: a monthly report failed", error);
      }
    });
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return sent;
}

/** The daily run: everyone who turned reminders on, at most one message each. */
export async function runReminders(today = new Date()): Promise<RunStats | null> {
  // Cron jobs can fire twice: one run a day.
  if (!(await claim("reminders-run", today.toISOString().slice(0, 10), 20 * 60 * 60 * 1000))) return null;
  const stats: RunStats = { people: 0, reminded: 0, push: 0, email: 0, failed: 0 };
  const { database } = await createAdminClient();
  const people: { id: string; email: string; settings: NotifySettings }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await database.listDocuments(DATABASE_ID!, USER_COLLECTION_ID!, [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    for (const doc of page.documents as unknown as { $id: string; email?: string; prefs?: string }[]) {
      if (!doc.prefs?.includes('"notify"')) continue;
      let settings: NotifySettings;
      try {
        settings = readNotify(JSON.parse(doc.prefs).notify);
      } catch {
        continue;
      }
      if (settings.email || settings.push.length) people.push({ id: doc.$id, email: doc.email ?? "", settings });
    }
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }

  await mapWithLimit(people, 4, async (person) => {
    stats.people++;
    try {
      const heads = await headsUpForOwner(person.id, today);
      // One message a day: what is due comes first; Monday's statement nudge only on a quiet day.
      const reminder: Reminder | null =
        reminderFor(heads, person.settings.sent) ?? (person.settings.weekly ? uploadReminder(heads.latest, today, person.settings.sent) : null);
      if (!reminder) return;
      const result = await deliver(person.id, person.email, person.settings, messageFor(reminder.kind, reminder.count, person.settings), reminder.keys);
      if (result.push || result.email) stats.reminded++;
      stats.push += result.push;
      stats.email += result.email ? 1 : 0;
    } catch (error) {
      stats.failed++;
      logError("notify: a reminder failed", error);
    }
  });
  return stats;
}
