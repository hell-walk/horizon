"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useT } from "@/components/providers/i18nProvider";
import { cancelMySubscription, checkSubscription, confirmSubscriptionPayment, startSubscription } from "@/lib/actions/plan.action";
import type { Period, PlanState } from "@/lib/content/plans";
import { cn } from "@/lib/utils";

type Props = {
  plan: PlanState;
  daysLeft: number;
  untilText: string;
  prices: Record<Period, string>;
  ready: Record<Period, boolean>;
  testMode: boolean;
  /** A discount from a redeemed promo code, e.g. "50% off for 3 months"; empty when none. */
  offerText: string;
};

// Razorpay's checkout box, loaded only when someone presses Subscribe.
const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
type CheckoutAnswer = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayBox = { open: () => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayBox;
  }
}
let scriptLoading: Promise<void> | null = null;
const loadCheckout = () => {
  if (window.Razorpay) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("checkout script did not load"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
};

type Outcome = "success" | "pending" | "failed" | null;

/** Where you stand, and the two plans. Paying happens in Razorpay's box, over this page. */
const PlansPanel = ({ plan, daysLeft, untilText, prices, ready, testMode, offerText }: Props) => {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<Period | "check" | "cancel" | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [, startTransition] = useTransition();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (outcome) closeButton.current?.focus();
  }, [outcome]);

  const subscribe = async (period: Period) => {
    setBusy(period);
    setMessage(null);
    try {
      const started = await startSubscription({ period });
      if (!started.ok) {
        setMessage({ text: started.error, bad: true });
        setBusy(null);
        return;
      }
      try {
        await loadCheckout();
      } catch {
        // The box could not load (an ad blocker, a slow network): Razorpay's own page instead.
        window.location.assign(started.url);
        return;
      }
      const box = new window.Razorpay!({
        key: started.keyId,
        subscription_id: started.subscriptionId,
        name: "Horizon",
        description: t(period === "monthly" ? "plan.monthly" : "plan.yearly"),
        theme: { color: "#1A1C1A" },
        handler: async (answer: CheckoutAnswer) => {
          try {
            const result = await confirmSubscriptionPayment({ paymentId: answer.razorpay_payment_id, signature: answer.razorpay_signature });
            setOutcome(result.ok && result.subscribed ? "success" : "pending");
          } catch {
            setOutcome("pending");
          }
          setBusy(null);
          startTransition(() => router.refresh());
        },
        modal: {
          ondismiss: () => {
            setOutcome("failed");
            setBusy(null);
          },
        },
      });
      box.open();
    } catch {
      setMessage({ text: t("common.notReachable"), bad: true });
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy("check");
    setMessage(null);
    try {
      const result = await checkSubscription();
      if (!result.ok) setMessage({ text: result.error, bad: true });
      else if (!result.subscribed) setMessage({ text: t("plan.stillPending"), bad: false });
      else startTransition(() => router.refresh());
    } catch {
      setMessage({ text: t("common.notReachable"), bad: true });
    }
    setBusy(null);
  };

  const cancel = async () => {
    if (!window.confirm(t("plan.cancelConfirm", { date: untilText }))) return;
    setBusy("cancel");
    setMessage(null);
    try {
      const result = await cancelMySubscription();
      if (!result.ok) setMessage({ text: result.error, bad: true });
      else {
        setMessage({ text: t("plan.cancelled", { date: untilText }), bad: false });
        startTransition(() => router.refresh());
      }
    } catch {
      setMessage({ text: t("common.notReachable"), bad: true });
    }
    setBusy(null);
  };

  const status =
    plan.kind === "subscribed"
      ? {
          title: `${t("plan.statusSubscribed")} · ${t(plan.period === "monthly" ? "plan.monthly" : "plan.yearly")}`,
          body: t(plan.renews ? "plan.renewsOn" : "plan.endsOn", { date: untilText }),
        }
      : plan.kind === "trial"
        ? {
            title: t("plan.statusTrial"),
            body: `${t("plan.bannerTrial", { count: daysLeft })} · ${t("plan.bannerUsed", { used: plan.usedToday, limit: plan.limit })}`,
          }
        : { title: t("plan.statusEnded"), body: t("plan.statusEndedBody") };

  const popup =
    outcome &&
    {
      success: { title: t("plan.paySuccessTitle"), body: t("plan.paySuccessBody"), tone: "text-success" },
      pending: { title: t("plan.payPendingTitle"), body: t("plan.payPendingBody"), tone: "text-warn-ink" },
      failed: { title: t("plan.payFailTitle"), body: t("plan.payFailBody"), tone: "text-danger" },
    }[outcome];

  return (
    <div className="flex flex-col gap-6">
      <section className={cn("panel", plan.kind === "ended" && "border-warn/50")} aria-labelledby="plan-status">
        <div className="panel-body flex flex-col gap-2">
          <h2 id="plan-status" className="font-display text-18 font-semibold text-ink">
            {status.title}
          </h2>
          <p className="text-14 text-ink">{status.body}</p>
          {plan.kind !== "subscribed" && <p className="text-13 text-ink-muted">{t("plan.whatCounts")}</p>}
          {plan.kind === "ended" && plan.pending && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-13 text-ink-muted">{t("plan.pendingBody")}</p>
              <button type="button" onClick={check} disabled={busy !== null} className="btn-ghost w-fit">
                {busy === "check" && <Loader2 className="size-4 animate-spin" />} {t("plan.checkButton")}
              </button>
            </div>
          )}
          {plan.kind === "subscribed" && plan.renews && (
            <button type="button" onClick={cancel} disabled={busy !== null} className="btn-ghost mt-1 w-fit">
              {busy === "cancel" && <Loader2 className="size-4 animate-spin" />} {t("plan.cancelButton")}
            </button>
          )}
        </div>
      </section>

      {offerText && plan.kind !== "subscribed" && (
        <p className="chip chip-lime w-fit text-13 normal-case tracking-normal">{t("plan.offerApplied", { text: offerText })}</p>
      )}

      {plan.kind !== "subscribed" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["monthly", "yearly"] as const).map((period) => (
            <section key={period} className={cn("panel", period === "yearly" && "border-primary/60")} aria-labelledby={`plan-${period}`}>
              <div className="panel-body flex h-full flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${period}`} className="eyebrow">
                    {t(period === "monthly" ? "plan.monthly" : "plan.yearly")}
                  </h2>
                  {period === "yearly" && <span className="chip chip-lime">{t("plan.yearlySave")}</span>}
                </div>
                <p className="flex items-baseline gap-1">
                  <span className="font-display text-32 font-semibold text-ink">{prices[period]}</span>
                  <span className="text-14 text-ink-muted">{t(period === "monthly" ? "plan.perMonth" : "plan.perYear")}</span>
                </p>
                <ul className="flex flex-1 flex-col gap-2 text-14 text-ink">
                  {["plan.included1", "plan.includedLoans", "plan.includedSpending", "plan.included2", "plan.included3"].map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t(key)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => subscribe(period)}
                  disabled={busy !== null || !ready[period]}
                  className="btn-primary w-full justify-center"
                >
                  {busy === period ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t("plan.payOpening")}
                    </>
                  ) : (
                    t("plan.subscribeButton")
                  )}
                </button>
                {!ready[period] && <p className="text-13 text-ink-muted">{t("plan.errNotReady")}</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-13 text-ink-muted">
        <Link href="/pricing" className="underline underline-offset-4 hover:text-ink">
          {t("plan.seePricing")}
        </Link>
        {" · "}
        <Link href="/refunds" className="underline underline-offset-4 hover:text-ink">
          {t("plan.seeRefunds")}
        </Link>
      </p>
      {testMode && <p className="text-13 text-ink-muted">{t("plan.testMode")}</p>}
      {message && (
        <p role={message.bad ? "alert" : "status"} className={message.bad ? "field-error" : "text-14 text-ink"}>
          {message.text}
        </p>
      )}

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOutcome(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pay-outcome-title" onClick={(e) => e.stopPropagation()} className="panel w-full max-w-md">
            <div className="panel-body flex flex-col gap-3">
              <h2 id="pay-outcome-title" className={cn("font-display text-20 font-semibold", popup.tone)}>
                {popup.title}
              </h2>
              <p className="text-14 text-ink">{popup.body}</p>
              <button ref={closeButton} type="button" onClick={() => setOutcome(null)} className="btn-primary mt-1 w-fit">
                {t("plan.payClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlansPanel;
