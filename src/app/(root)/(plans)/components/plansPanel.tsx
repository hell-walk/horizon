"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useT } from "@/components/i18nProvider";
import { cancelMySubscription, checkSubscription, startSubscription } from "@/lib/actions/plan.action";
import type { Period, PlanState } from "@/lib/plans";
import { cn } from "@/lib/utils";

type Props = {
  plan: PlanState;
  daysLeft: number;
  untilText: string;
  prices: Record<Period, string>;
  ready: Record<Period, boolean>;
  testMode: boolean;
};

/** Where you stand, and the two plans. Paying happens on Razorpay's own page. */
const PlansPanel = ({ plan, daysLeft, untilText, prices, ready, testMode }: Props) => {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<Period | "check" | "cancel" | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [, startTransition] = useTransition();

  const subscribe = async (period: Period) => {
    setBusy(period);
    setMessage(null);
    try {
      const result = await startSubscription({ period });
      if (result.ok) {
        window.location.assign(result.url);
        return; // stays busy while the browser leaves
      }
      setMessage({ text: result.error, bad: true });
    } catch {
      setMessage({ text: t("common.notReachable"), bad: true });
    }
    setBusy(null);
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
      ? { title: `${t("plan.statusSubscribed")} · ${t(plan.period === "monthly" ? "plan.monthly" : "plan.yearly")}`, body: t(plan.renews ? "plan.renewsOn" : "plan.endsOn", { date: untilText }) }
      : plan.kind === "trial"
        ? { title: t("plan.statusTrial"), body: `${t("plan.bannerTrial", { count: daysLeft })} · ${t("plan.bannerUsed", { used: plan.usedToday, limit: plan.limit })}` }
        : { title: t("plan.statusEnded"), body: t("plan.statusEndedBody") };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
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
                  {["plan.included1", "plan.included2", "plan.included3"].map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t(key)}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => subscribe(period)} disabled={busy !== null || !ready[period]} className="btn-primary w-full justify-center">
                  {busy === period ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t("plan.opening")}
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

      {testMode && <p className="text-13 text-ink-muted">{t("plan.testMode")}</p>}
      {message && (
        <p role={message.bad ? "alert" : "status"} className={message.bad ? "field-error" : "text-14 text-ink"}>
          {message.text}
        </p>
      )}
    </div>
  );
};

export default PlansPanel;
