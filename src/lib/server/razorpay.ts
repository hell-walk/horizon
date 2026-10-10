import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Period, Subscription } from "../plans";

// Razorpay subscriptions, through its REST API (no SDK, no script on the page:
// people pay on Razorpay's own hosted page). Keys stay on the server.
//
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET      API keys (test mode while building)
//   RAZORPAY_PLAN_MONTHLY, RAZORPAY_PLAN_YEARLY  plan ids (scripts/setup-razorpay-plans.mjs)
//   RAZORPAY_WEBHOOK_SECRET                   checks that webhooks really come from Razorpay

const API = "https://api.razorpay.com/v1";

const planIds = (): Record<Period, string | undefined> => ({
  monthly: process.env.RAZORPAY_PLAN_MONTHLY,
  yearly: process.env.RAZORPAY_PLAN_YEARLY,
});

export const isRazorpayConfigured = (period: Period) => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && planIds()[period]);

/** Test keys start with rzp_test_: the plans page then says no real money is charged. */
export const isTestMode = () => (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  // Razorpay's message only, never the request (it carries nothing secret, but stay tidy).
  if (!res.ok) throw new Error(`razorpay ${method} ${path.split("/")[1]}: ${res.status} ${json.error?.description ?? ""}`);
  return json;
}

/** Razorpay's view of a subscription (only the fields Horizon uses). */
export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  current_end?: number | null;
  short_url?: string;
  notes?: Record<string, string>;
};

/** What Horizon stores from Razorpay's subscription. */
export function toSubscription(sub: RazorpaySubscription): Subscription | null {
  const ids = planIds();
  const period: Period | null = sub.plan_id === ids.monthly ? "monthly" : sub.plan_id === ids.yearly ? "yearly" : null;
  if (!period) return null;
  return { id: sub.id, period, status: sub.status, until: sub.current_end ? sub.current_end * 1000 : 0 };
}

/**
 * Starts a subscription for one login and returns Razorpay's payment page.
 * The login's id travels in the notes, so the webhook knows whose it is.
 */
export async function createSubscription(period: Period, loginId: string) {
  const planId = planIds()[period]!;
  // Razorpay needs a number of charges: about ten years either way.
  const sub = await call<RazorpaySubscription>("POST", "/subscriptions", {
    plan_id: planId,
    total_count: period === "monthly" ? 120 : 10,
    customer_notify: 1,
    notes: { login: loginId },
  });
  return sub;
}

export const fetchSubscription = (id: string) => call<RazorpaySubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`);

/** Stops it at once, for an account being deleted: nothing more is ever charged. */
export const cancelSubscriptionNow = (id: string) => call<RazorpaySubscription>("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 0 });

/** Stops renewing; access lasts to the end of the period already paid. */
export const cancelSubscription = (id: string) => call<RazorpaySubscription>("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 1 });

/** Is this webhook body really from Razorpay? (HMAC-SHA256 of the exact body with the webhook secret.) */
export function webhookIsGenuine(body: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
