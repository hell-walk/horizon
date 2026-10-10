"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";
import { mergeSubscription, planFrom, type Period } from "../plans";
import { loadSession } from "../server/auth";
import { logError } from "../server/log";
import { saveSubscription } from "../server/plan";
import { cancelSubscription, createSubscription, fetchSubscription, isRazorpayConfigured, toSubscription } from "../server/razorpay";
import { allow, MINUTE } from "../server/rateLimit";
import { claim, release } from "../server/shared";

// The plans page's three actions. Every export here is a public endpoint: each
// one takes the person from the session, and only ever touches the
// subscription stored on their own login.

type Failure = { ok: false; error: string };

/** Starts a subscription and returns Razorpay's payment page to send the browser to. */
export async function startSubscription(input: { period: Period }): Promise<{ ok: true; url: string } | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  const period = input?.period;
  if (period !== "monthly" && period !== "yearly") return { ok: false, error: t("plan.errStart") };
  if (!isRazorpayConfigured(period)) return { ok: false, error: t("plan.errNotReady") };
  if (!(await allow(`plan:start:${session.id}`, 5, 10 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };
  if (planFrom({ joinedAt: session.joinedAt, subscription: session.subscription, usedToday: 0 }).kind === "subscribed") return { ok: false, error: t("plan.errAlready") };
  // One at a time per login (two tabs, a double click): the second waits for
  // the first instead of opening a second subscription. Shared through Redis.
  if (!(await claim("plan-start", session.id, 30_000))) return { ok: false, error: t("plan.errInProgress") };

  try {
    // A payment page already opened for this plan and not paid yet: send them back to it.
    const earlier = session.subscription;
    if (earlier && earlier.period === period && earlier.status === "created") {
      const again = await fetchSubscription(earlier.id).catch(() => null);
      if (again?.status === "created" && again.short_url) return { ok: true, url: again.short_url };
    }
    const created = await createSubscription(period, session.id);
    const stored = toSubscription(created);
    if (!stored || !created.short_url) throw new Error("razorpay: unexpected subscription");
    await saveSubscription(session.id, stored);
    return { ok: true, url: created.short_url };
  } catch (error) {
    logError("plan: could not start a subscription", error);
    return { ok: false, error: t("plan.errStart") };
  } finally {
    await release("plan-start", session.id);
  }
}

/** Asks Razorpay how the person's subscription stands now (for "I have paid: check again"). */
export async function checkSubscription(): Promise<{ ok: true; subscribed: boolean } | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  if (!session.subscription) return { ok: false, error: t("plan.errNothing") };
  if (!(await allow(`plan:check:${session.id}`, 20, 10 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };

  try {
    const latest = toSubscription(await fetchSubscription(session.subscription.id));
    if (!latest) throw new Error("razorpay: unknown plan");
    const fresh = mergeSubscription(session.subscription, latest);
    await saveSubscription(session.id, fresh);
    revalidatePath("/", "layout");
    return { ok: true, subscribed: planFrom({ joinedAt: session.joinedAt, subscription: fresh, usedToday: 0 }).kind === "subscribed" };
  } catch (error) {
    logError("plan: could not check the subscription", error);
    return { ok: false, error: t("plan.errStart") };
  }
}

/** Stops renewing. Access lasts to the end of the period already paid. */
export async function cancelMySubscription(): Promise<{ ok: true; until: number } | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  const current = session.subscription;
  if (!current || current.status === "cancelled" || current.status === "completed") return { ok: false, error: t("plan.errNothing") };
  if (!(await allow(`plan:cancel:${session.id}`, 5, 10 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };

  try {
    const after = toSubscription(await cancelSubscription(current.id));
    // Razorpay keeps it "active" until the period ends; Horizon shows it as not renewing.
    const stored = after ? { ...after, status: "cancelled", until: Math.max(after.until, current.until) } : { ...current, status: "cancelled" };
    await saveSubscription(session.id, stored);
    revalidatePath("/", "layout");
    return { ok: true, until: stored.until };
  } catch (error) {
    logError("plan: could not cancel the subscription", error);
    return { ok: false, error: t("plan.errStart") };
  }
}
