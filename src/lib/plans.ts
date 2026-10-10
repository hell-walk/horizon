// Horizon's plans. THE place to change the trial, the daily limit and the
// prices: everything else (limits, the plans page, the banner) reads them
// from here. Prices must also match the Razorpay plans
// (scripts/setup-razorpay-plans.mjs creates those from these numbers).

/** How long a new account may try Horizon for free. No card needed. */
export const TRIAL_DAYS = 7;
/** Changes a day during the trial (imports, corrections, goals, bank links, transfers, card colours). */
export const TRIAL_CHANGES_PER_DAY = 3;

export type Period = "monthly" | "yearly";
export const PRICES: Record<Period, { amount: number; currency: "INR" }> = {
  monthly: { amount: 99, currency: "INR" },
  yearly: { amount: 999, currency: "INR" },
};

const DAY = 24 * 60 * 60 * 1000;

/** A subscription as the server stores it (on the Supabase login, which only the server can write). */
export type Subscription = {
  id: string;
  period: Period;
  /** Razorpay's status: created, authenticated, active, pending, halted, cancelled, completed, expired. */
  status: string;
  /** Paid up to (milliseconds). 0 until the first payment. */
  until: number;
};

export type PlanState =
  | { kind: "subscribed"; until: number; renews: boolean; period: Period }
  | { kind: "trial"; endsAt: number; usedToday: number; limit: number }
  | { kind: "ended"; endedAt: number; pending: boolean };

/** Statuses after which Razorpay will not charge again. */
const FINAL = new Set(["cancelled", "completed", "expired", "halted"]);

/** Where someone stands, from when they joined, their subscription and today's changes. */
export function planFrom({ joinedAt, subscription, usedToday, now = Date.now() }: { joinedAt: number; subscription: Subscription | null; usedToday: number; now?: number }): PlanState {
  if (subscription && subscription.until > now) {
    return { kind: "subscribed", until: subscription.until, renews: !FINAL.has(subscription.status), period: subscription.period };
  }
  const endsAt = joinedAt + TRIAL_DAYS * DAY;
  if (now < endsAt) return { kind: "trial", endsAt, usedToday, limit: TRIAL_CHANGES_PER_DAY };
  // A subscription started but not paid yet ("created"): the plans page offers to check again.
  return { kind: "ended", endedAt: Math.max(endsAt, subscription?.until ?? 0), pending: subscription?.status === "created" || subscription?.status === "authenticated" };
}

/** Days left, counting a part day as a day (6.2 days left shows as 7). */
export const daysLeft = (endsAt: number, now = Date.now()) => Math.max(0, Math.ceil((endsAt - now) / DAY));

/** Today's date in India (the daily count starts again at midnight IST), e.g. "2026-10-11". */
export const istDay = (now = Date.now()) => new Date(now + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Reads a stored subscription defensively: anything malformed counts as none. */
export function readSubscription(value: unknown): Subscription | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || (v.period !== "monthly" && v.period !== "yearly") || typeof v.status !== "string") return null;
  return { id: v.id, period: v.period, status: v.status, until: typeof v.until === "number" && Number.isFinite(v.until) ? v.until : 0 };
}

/**
 * Razorpay's newer view of a subscription, keeping what Horizon already knows:
 * one cancelled "at the end of the period" stays cancelled here although
 * Razorpay calls it active until then, and a paid-up date never moves back.
 */
export function mergeSubscription(known: Subscription | null, fresh: Subscription): Subscription {
  if (!known) return fresh;
  // Another subscription: a late message about an older one never replaces a newer one.
  if (known.id !== fresh.id) return fresh.until > known.until ? fresh : known;
  const status = known.status === "cancelled" && fresh.status === "active" ? "cancelled" : fresh.status;
  return { ...fresh, status, until: Math.max(known.until, fresh.until) };
}
