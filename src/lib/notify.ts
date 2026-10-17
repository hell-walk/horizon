import type { HeadsUp, HeadsUpResult } from "./headsUp";
import { LOCALES, type Locale } from "./i18n/config";

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
  };
}

/** Adds a device (or refreshes it), keeping the newest few. */
export function withDevice(settings: NotifySettings, sub: PushSubscription): NotifySettings {
  const others = settings.push.filter((p) => p.endpoint !== sub.endpoint);
  return { ...settings, push: [...others, sub].slice(-MAX_DEVICES) };
}

export type ReminderKind = "shortfall" | "emi" | "charge";
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
export function reminderFor(result: HeadsUpResult, sent: string[]): Reminder | null {
  const fresh = (item: HeadsUp) => !sent.includes(keyOf(item));
  const emis = result.items.filter((i): i is Extract<HeadsUp, { kind: "emi" }> => i.kind === "emi" && i.days <= SEND_WITHIN.emi);
  const shortfalls = result.items.filter((i) => i.kind === "shortfall" && fresh(i));
  if (shortfalls.length && emis.length) return { kind: "shortfall", count: shortfalls.length, keys: [...shortfalls, ...emis].map(keyOf) };
  const dueEmis = emis.filter(fresh);
  if (dueEmis.length) return { kind: "emi", count: dueEmis.length, keys: dueEmis.map(keyOf) };
  const charges = result.items.filter((i) => i.kind === "charge" && i.days <= SEND_WITHIN.charge && fresh(i));
  if (charges.length) return { kind: "charge", count: charges.length, keys: charges.map(keyOf) };
  return null;
}

/** The sent list after a message went out: the new keys added, the oldest dropped. */
export const markSent = (sent: string[], keys: string[]) => [...sent.filter((k) => !keys.includes(k)), ...keys].slice(-MAX_SENT);
