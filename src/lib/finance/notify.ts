import type { HeadsUp, HeadsUpResult } from "./headsUp";
import { LOCALES, type Locale } from "../i18n/config";

// Reminders: the "Be prepared" items, sent to the phone (web push) and/or by
// email before money leaves an account. Opt-in only, both off until the
// person turns them on. What is sent says as little as possible (no amounts,
// no bank names): a lock screen and an inbox are not private places.

export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string }; added: number };

export type NotifySettings = {
  email: boolean;
  push: PushSubscription[];
  /** The language reminders are written in: chosen (regional or English), else the one Horizon was in when they were turned on. */
  locale: Locale;
  /** The person picked the reminders' language themselves: turning a channel on later does not change it. */
  localeChosen: boolean;
  /** What has been sent already ("emi:<account>:<date>"), so nothing is sent twice. Newest last. */
  sent: string[];
  /** Monday's nudge to upload the newer statement when the saved entries are over a week old. On unless switched off. */
  weekly: boolean;
  /** The month's report by email on the 1st, when email is on. On unless switched off. */
  monthly: boolean;
  /** EMI reminders (and the shortfall warning that goes with them). On unless switched off. */
  emis: boolean;
  /** Bank-charge alerts. On unless switched off. */
  charges: boolean;
};

export const MAX_DEVICES = 5;
const MAX_SENT = 120;

/**
 * Where a browser's push service lives. The server sends to the endpoint the
 * browser gives, so only these hosts are accepted: anything else could point
 * the server at an address it should never call.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

const isKey = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{8,200}={0,2}$/.test(value);

/** A browser's push subscription as sent from the page, checked; null when anything is off. */
export function readPushSubscription(value: unknown, now = Date.now()): PushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isPushEndpoint(v.endpoint) || !isKey(v.keys?.p256dh) || !isKey(v.keys?.auth)) return null;
  return { endpoint: v.endpoint, keys: { p256dh: v.keys!.p256dh as string, auth: v.keys!.auth as string }, added: now };
}

/** The stored settings, read defensively: anything malformed is left out. */
export function readNotify(value: unknown): NotifySettings {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const push = Array.isArray(v.push)
    ? v.push
        .map((p) => {
          const sub = readPushSubscription(p);
          const added = typeof (p as { added?: unknown })?.added === "number" ? (p as { added: number }).added : 0;
          return sub ? { ...sub, added } : null;
        })
        .filter((p): p is PushSubscription => p !== null)
        .slice(-MAX_DEVICES)
    : [];
  return {
    email: v.email === true,
    push,
    locale: LOCALES.includes(v.locale as Locale) ? (v.locale as Locale) : "en",
    localeChosen: v.localeChosen === true,
    sent: Array.isArray(v.sent) ? v.sent.filter((s): s is string => typeof s === "string" && s.length <= 120).slice(-MAX_SENT) : [],
    weekly: v.weekly !== false,
    monthly: v.monthly !== false,
    emis: v.emis !== false,
    charges: v.charges !== false,
  };
}

/** Adds a device (or refreshes it), keeping the newest few. */
export function withDevice(settings: NotifySettings, sub: PushSubscription): NotifySettings {
  const others = settings.push.filter((p) => p.endpoint !== sub.endpoint);
  return { ...settings, push: [...others, sub].slice(-MAX_DEVICES) };
}

export type ReminderKind = "shortfall" | "emi" | "charge" | "upload";
export type Reminder = { kind: ReminderKind; count: number; keys: string[] };

/** EMIs and charges this close are worth a message; nearer than that it is too late to act. */
const SEND_WITHIN: Record<"emi" | "charge", number> = { emi: 2, charge: 3 };

const keyOf = (item: HeadsUp) =>
  item.kind === "emi"
    ? `emi:${item.account.id}:${item.date}`
    : item.kind === "charge"
      ? `charge:${item.account.id}:${item.charge}:${item.date}`
      : item.kind === "shortfall"
        ? `short:${item.account.id}:${item.asOf}`
        : `minbal:${item.account.id}:${item.date}`;

/**
 * The one message worth sending today, or null: a shortfall first (money may
 * bounce), then EMIs due within two days, then charges within three. Items
 * already sent are skipped; the minimum-balance reminder stays in the app.
 */
export function reminderFor(
  result: HeadsUpResult,
  sent: string[],
  kinds: { emis: boolean; charges: boolean } = { emis: true, charges: true },
): Reminder | null {
  const fresh = (item: HeadsUp) => !sent.includes(keyOf(item));
  const emis = kinds.emis ? result.items.filter((i): i is Extract<HeadsUp, { kind: "emi" }> => i.kind === "emi" && i.days <= SEND_WITHIN.emi) : [];
  const shortfalls = kinds.emis ? result.items.filter((i) => i.kind === "shortfall" && fresh(i)) : [];
  if (shortfalls.length && emis.length) return { kind: "shortfall", count: shortfalls.length, keys: [...shortfalls, ...emis].map(keyOf) };
  const dueEmis = emis.filter(fresh);
  if (dueEmis.length) return { kind: "emi", count: dueEmis.length, keys: dueEmis.map(keyOf) };
  const charges = kinds.charges ? result.items.filter((i) => i.kind === "charge" && i.days <= SEND_WITHIN.charge && fresh(i)) : [];
  if (charges.length) return { kind: "charge", count: charges.length, keys: charges.map(keyOf) };
  return null;
}

/** The ISO week a date falls in, "2026-W43": the upload nudge goes at most once a week. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides the year
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Entries this old with nothing newer: the statement for the week is probably out. */
const UPLOAD_AFTER_DAYS = 7;

/**
 * Monday's nudge to upload the newer statement, when the newest saved entry is
 * more than a week old (or there is none at all). Runs after reminderFor: a due
 * EMI or charge is the day's one message, and the nudge waits for next Monday.
 */
export function uploadReminder(latest: string | null, today: Date, sent: string[]): Reminder | null {
  // Any quiet day once the newest entry is a week old (the caller sends what is
  // due first), and then not again that ISO week: a steady weekly nudge that
  // starts the day the statements fall behind, not the next Monday after.
  const key = `upload:${isoWeek(today)}`;
  if (sent.includes(key)) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const age = latest && Number.isFinite(Date.parse(`${latest}T00:00:00Z`)) ? (todayUtc - Date.parse(`${latest}T00:00:00Z`)) / 86_400_000 : Infinity;
  if (age < UPLOAD_AFTER_DAYS) return null;
  return { kind: "upload", count: 1, keys: [key] };
}

/** The sent list after a message went out: the new keys added, the oldest dropped. */
export const markSent = (sent: string[], keys: string[]) => [...sent.filter((k) => !keys.includes(k)), ...keys].slice(-MAX_SENT);
