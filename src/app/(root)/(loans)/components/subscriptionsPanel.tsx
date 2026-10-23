import { Gem, Lock, Repeat } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/regularText";
import { planGuesses } from "@/lib/planNames";
import { currentPlan } from "@/lib/server/plan";
import { subscriptionsForOwner } from "@/lib/server/subscriptions";
import type { Subscription } from "@/lib/subscriptions";
import { cn, formatAmount } from "@/lib/utils";

import PlanName from "./planName";

/**
 * Subscriptions, beside the loans: what the running ones cost a month and a
 * year, which have stopped, and what each has taken so far. The totals for
 * everyone; the list for subscribers, like the loans above it.
 */
const SubscriptionsPanel = async ({ ownerId }: { ownerId: string }) => {
  const [picture, plan, t, locale] = await Promise.all([subscriptionsForOwner(ownerId), currentPlan(), getT(), getLocale()]);
  const money = (n: number) => formatAmount(Math.round(n), picture.currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const subscribed = plan?.kind === "subscribed";
  const none = picture.active.length === 0 && picture.stopped.length === 0;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="subs-title">
      <header className="flex flex-col gap-1">
        <h2 id="subs-title" className="eyebrow flex items-center gap-2">
          <Repeat className="size-3.5" aria-hidden /> {t("loans.subsTitle")}
        </h2>
        <p className="text-13 text-ink-muted">{t("loans.subsIntro")}</p>
      </header>

      {none ? (
        <p className="panel panel-body text-14 text-ink-muted">{t("loans.subsNone")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={t("loans.subsTileMonthly")} value={money(picture.monthly)} note={t("loans.subsTileCount", { count: picture.active.length })} />
            <Tile label={t("loans.subsTileYearly")} value={money(picture.yearly)} note={t("loans.subsTileYearlyNote")} warn={picture.yearly > 0} />
            <Tile
              label={t("loans.subsTilePaid")}
              value={money(picture.paid)}
              note={t("loans.subsTilePaidNote", { count: picture.active.length + picture.stopped.length })}
            />
          </div>

          {subscribed ? (
            <>
              {picture.active.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {picture.active.map((s) => (
                    <Row key={s.key} s={s} t={t} day={day} />
                  ))}
                </ul>
              )}
              {picture.stopped.length > 0 && (
                <details className="panel">
                  <summary className="panel-head cursor-pointer">
                    <span className="eyebrow">{t("loans.subsStoppedTitle", { count: picture.stopped.length })}</span>
                  </summary>
                  <ul className="flex flex-col gap-2 p-3">
                    {picture.stopped.map((s) => (
                      <Row key={s.key} s={s} t={t} day={day} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="panel panel-body flex flex-col gap-3">
              <p className="flex items-start gap-2 text-14 text-ink">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("loans.subsLocked")}</span>
              </p>
              <Link href="/plans" className="btn-primary w-fit">
                <Gem className="size-4" aria-hidden /> {t("home.checksSeePlans")}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const Row = ({ s, t, day }: { s: Subscription; t: Translate; day: (d: string) => string }) => {
  const amount = (n: number) => formatAmount(n, s.currency);
  return (
    <li className={cn("panel flex flex-col gap-1 p-4", s.status === "stopped" && "opacity-80")}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span translate="no" className="text-16 font-semibold text-ink">
          {s.name}
        </span>
        <span className="chip">{t(`loans.subsCadence_${s.cadence}`)}</span>
        {s.status === "stopped" && <span className="chip">{t("loans.subsStopped")}</span>}
        <span translate="no" className={cn("amount ml-auto text-16 font-semibold", s.status === "stopped" ? "text-ink-muted" : "text-danger")}>
          {amount(s.amount)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-13 text-ink-muted">
          {t("loans.subsPaid", { amount: amount(s.paid), count: s.count, date: day(s.since) })}
          {s.status === "active" && s.next ? ` · ${t("loans.subsNext", { date: day(s.next) })}` : ""}
          {s.status === "stopped" ? ` · ${t("loans.subsLast", { date: day(s.last) })}` : ""}
        </p>
        {s.accountId && <PlanName accountId={s.accountId} txId={s.txId} named={!!s.named} guesses={planGuesses(s.payee ?? "", s.amount, s.currency)} />}
      </div>
    </li>
  );
};

const Tile = ({ label, value, note, warn = false }: { label: string; value: string; note: string; warn?: boolean }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <p className="eyebrow">{label}</p>
    <p translate="no" className={cn("amount text-20 font-semibold", warn ? "text-warn-ink" : "text-ink")}>
      {value}
    </p>
    <p className="eyebrow">{note}</p>
  </article>
);

export default SubscriptionsPanel;
