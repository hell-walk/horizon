import "server-only";

import { istDay, mergeSubscription, planFrom, type PlanState, type Subscription } from "../content/plans";
import type { Translate } from "../i18n/translate";
import { loadSession, type SessionUser } from "./auth";
import { logError } from "./log";
import { record, used } from "./rateLimit";
import { fetchSubscription, toSubscription } from "./razorpay";
import { claim } from "./shared";
import { createSupabaseAdmin } from "./supabase";

// The trial's daily limit and the read-only state after it, enforced on the
// server: the banner and the plans page only describe what this decides.
// Never counted or locked: viewing, downloading your data, removing a bank,
// deleting the account (privacy rights do not depend on paying).

const changesKey = (session: SessionUser) => `plan:changes:${session.id}:${istDay()}`;
const COUNT_WINDOW = 26 * 60 * 60 * 1000; // past midnight IST from any time zone

const DAY = 24 * 60 * 60 * 1000;
const FINAL = new Set(["cancelled", "completed", "expired"]);

/**
 * Razorpay tells Horizon about renewals, failed payments and cancellations by
 * webhook, but a webhook can be missing or late. So a subscription that is
 * still unconfirmed, or within three days of its paid-up date, or past it, is
 * checked with Razorpay directly, at most once an hour per person. The plan is
 * right whichever way the news arrives.
 */
export async function refreshIfStale(session: SessionUser): Promise<Subscription | null> {
  const sub = session.subscription;
  if (!sub || sub.id.startsWith("comp_") || FINAL.has(sub.status)) return sub;
  const unconfirmed = sub.until === 0;
  const nearEnd = sub.until < Date.now() + 3 * DAY;
  if (!unconfirmed && !nearEnd) return sub;
  if (!(await claim("plan-refresh", session.id, 60 * 60 * 1000))) return sub;
  try {
    const latest = await toSubscription(await fetchSubscription(sub.id));
    if (!latest) return sub;
    const fresh = mergeSubscription(sub, latest);
    if (fresh.status !== sub.status || fresh.until !== sub.until) await saveSubscription(session.id, fresh);
    return fresh;
  } catch (error) {
    logError("plan: could not refresh the subscription from Razorpay", error);
    return sub;
  }
}

/** Where the signed-in person stands, or null when nobody is signed in. */
export async function currentPlan(): Promise<PlanState | null> {
  const session = await loadSession();
  if (!session) return null;
  const subscription = await refreshIfStale(session);
  return planFrom({ joinedAt: session.joinedAt, subscription, usedToday: await used(changesKey(session)) });
}

/**
 * Why the signed-in person cannot make a change right now (a message ready to
 * show), or null when they can. Check before the work, then call countChange
 * after it succeeds, so a refused or failed attempt costs nothing.
 */
export async function changeBlocked(t: Translate): Promise<string | null> {
  const plan = await currentPlan();
  if (!plan) return t("plan.errSignIn");
  if (plan.kind === "subscribed") return null;
  if (plan.kind === "ended") return t("plan.errEnded");
  return plan.usedToday >= plan.limit ? t("plan.errDailyLimit", { limit: plan.limit }) : null;
}

/** Counts one change towards today's trial limit (nothing to count for subscribers). */
export async function countChange() {
  const session = await loadSession();
  if (!session) return;
  const plan = planFrom({ joinedAt: session.joinedAt, subscription: await refreshIfStale(session), usedToday: 0 });
  if (plan.kind === "trial") await record(changesKey(session), COUNT_WINDOW);
}

/**
 * Stores a subscription on the Supabase login, in app_metadata: only the
 * server (service key) can write there, so nobody can grant themselves a plan.
 */
export async function saveSubscription(loginId: string, subscription: Subscription) {
  const { error } = await createSupabaseAdmin().auth.admin.updateUserById(loginId, { app_metadata: { subscription } });
  if (error) throw new Error(`could not save the subscription: ${error.message}`);
}
