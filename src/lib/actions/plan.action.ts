"use server";

import { revalidatePath } from "next/cache";

import { getT } from "../i18n/server";
import { mergeSubscription, planFrom, type Period } from "../plans";
import { loadSession } from "../server/auth";
import { logError } from "../server/log";
import { redeemCode } from "../server/codes";
import { saveSubscription } from "../server/plan";
import { cancelSubscription, createSubscription, fetchSubscription, isRazorpayConfigured, paymentSignatureIsGenuine, toSubscription } from "../server/razorpay";
import { allow, MINUTE } from "../server/rateLimit";
import { claim, release } from "../server/shared";

// The plans page's three actions. Every export here is a public endpoint: each
// one takes the person from the session, and only ever touches the
// subscription stored on their own login.

type Failure = { ok: false; error: string };

type Started = { ok: true; url: string; subscriptionId: string; keyId: string };

/**
 * Starts a subscription. The browser opens Razorpay's checkout box with the
 * subscription id and the (public) key id; `url` is Razorpay's hosted page,
 * the fallback when the box cannot load.
 */
export async function startSubscription(input: { period: Period }): Promise<Started | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  const period = input?.period;
  if (period !== "monthly" && period !== "yearly") return { ok: false, error: t("plan.errStart") };
  if (!(await isRazorpayConfigured(period))) return { ok: false, error: t("plan.errNotReady") };
  if (!(await allow(`plan:start:${session.id}`, 5, 10 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };
  if (planFrom({ joinedAt: session.joinedAt, subscription: session.subscription, usedToday: 0 }).kind === "subscribed")
    return { ok: false, error: t("plan.errAlready") };
  // One at a time per login (two tabs, a double click): the second waits for
  // the first instead of opening a second subscription. Shared through Redis.
  if (!(await claim("plan-start", session.id, 30_000))) return { ok: false, error: t("plan.errInProgress") };

  try {
    // A payment page already opened for this plan and not paid yet: send them back to it.
    const earlier = session.subscription;
    if (earlier && earlier.period === period && earlier.status === "created") {
      const again = await fetchSubscription(earlier.id).catch(() => null);
      if (again?.status === "created" && again.short_url)
        return { ok: true, url: again.short_url, subscriptionId: again.id, keyId: process.env.RAZORPAY_KEY_ID! };
    }
    // A discount from a promo code goes with it. Should Razorpay refuse the
    // offer (expired, or not for this plan), the subscription is started at
    // the full price: the checkout box shows the amount before anyone pays.
    const created = await createSubscription(period, session.id, session.offer?.id ?? "").catch(async (error) => {
      if (!session.offer?.id) throw error;
      logError("plan: Razorpay refused the code's offer; starting without it", error);
      return createSubscription(period, session.id);
    });
    const stored = await toSubscription(created);
    if (!stored || !created.short_url) throw new Error("razorpay: unexpected subscription");
    await saveSubscription(session.id, stored);
    return { ok: true, url: created.short_url, subscriptionId: created.id, keyId: process.env.RAZORPAY_KEY_ID! };
  } catch (error) {
    logError("plan: could not start a subscription", error);
    return { ok: false, error: t("plan.errStart") };
  } finally {
    await release("plan-start", session.id);
  }
}

/**
 * The checkout box's answer after a payment: Razorpay signs the payment id and
 * the subscription id with our key secret. The subscription id comes from our
 * own record, never from the browser. A good signature is followed by asking
 * Razorpay for the subscription itself and saving it, so the plan is right at
 * once, without waiting for the webhook.
 */
export async function confirmSubscriptionPayment(input: { paymentId: string; signature: string }): Promise<{ ok: true; subscribed: boolean } | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  const current = session.subscription;
  if (!current || current.id.startsWith("comp_")) return { ok: false, error: t("plan.errNothing") };
  if (!(await allow(`plan:confirm:${session.id}`, 20, 10 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };
  const paymentId = typeof input?.paymentId === "string" ? input.paymentId : "";
  const signature = typeof input?.signature === "string" ? input.signature : "";
  if (!/^pay_[A-Za-z0-9]{8,32}$/.test(paymentId) || !paymentSignatureIsGenuine(paymentId, current.id, signature)) {
    return { ok: false, error: t("plan.payNotConfirmed") };
  }
  try {
    const latest = await toSubscription(await fetchSubscription(current.id));
    if (!latest) throw new Error("razorpay: unknown plan");
    const fresh = mergeSubscription(current, latest);
    await saveSubscription(session.id, fresh);
    revalidatePath("/", "layout");
    return { ok: true, subscribed: planFrom({ joinedAt: session.joinedAt, subscription: fresh, usedToday: 0 }).kind === "subscribed" };
  } catch (error) {
    logError("plan: could not confirm the payment", error);
    return { ok: false, error: t("plan.errStart") };
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
    const latest = await toSubscription(await fetchSubscription(session.subscription.id));
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
    const after = await toSubscription(await cancelSubscription(current.id));
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

/** Redeems a promo or referral code for free days. One code per login, ever. */
export async function applyCode(input: { code: string }): Promise<{ ok: true; freeDays: number; until: number; discountText: string } | Failure> {
  const t = await getT();
  const session = await loadSession();
  if (!session) return { ok: false, error: t("plan.errSignIn") };
  const raw = typeof input?.code === "string" ? input.code : "";
  if (!raw.trim() || raw.length > 64) return { ok: false, error: t("plan.codeUnknown") };
  // Guessing codes must be slow; honest people type one or two.
  if (!(await allow(`plan:code:${session.id}`, 10, 60 * MINUTE))) return { ok: false, error: t("plan.errTooMany") };
  try {
    const result = await redeemCode(session, raw);
    if (result.ok) {
      revalidatePath("/", "layout");
      return result;
    }
    const messages: Record<typeof result.reason, string> = {
      unknown: "plan.codeUnknown",
      expired: "plan.codeExpired",
      "used-up": "plan.codeUsedUp",
      own: "plan.codeOwn",
      already: "plan.codeAlready",
      subscribed: "plan.codeSubscribed",
      "not-ready": "plan.errNotReady",
    };
    return { ok: false, error: t(messages[result.reason]) };
  } catch (error) {
    logError("plan: could not redeem a code", error);
    return { ok: false, error: t("plan.errStart") };
  }
}
