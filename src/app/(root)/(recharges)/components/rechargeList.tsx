import { AlertTriangle } from "lucide-react";

import { getLocale, getT } from "@/lib/i18n/server";
import type { Recharge } from "@/lib/finance/recharges";
import { dateFormat } from "@/lib/finance/regularText";
import { cn, formatAmount } from "@/lib/utils";

import RechargeDays from "./rechargeDays";

/**
 * One card per operator: the plan the person is on now (its price, how long
 * it lasts and where that comes from), when it runs out, what a month costs,
 * a warning when it ran out with nothing after it, and every recharge behind
 * it, each with its own length or "add-on".
 */
const RechargeList = async ({ items, currency }: { items: Recharge[]; currency: string }) => {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const money = (n: number) => formatAmount(n, currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <li key={r.operator} className={cn("panel flex flex-col gap-2 p-4", r.lapsed && "border-warn/40")}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span translate="no" className="text-16 font-semibold text-ink">
              {r.operator}
            </span>
            <span className="chip">
              {r.basis === "you"
                ? t("loans.rechargeDaysYou", { days: r.validityDays ?? 0 })
                : r.basis === "plan"
                  ? t("loans.rechargePlan", { days: r.validityDays ?? 0 })
                  : r.basis === "gaps"
                    ? t("loans.rechargeEvery", { days: r.validityDays ?? 0 })
                    : t("loans.rechargeNoLength")}
            </span>
            <span translate="no" className="amount ml-auto text-16 font-semibold text-ink">
              {r.perMonth ? t("loans.rechargePerMonth", { amount: money(Math.round(r.perMonth)) }) : money(r.amount)}
            </span>
          </div>

          <p className="text-13 text-ink">
            {t("loans.rechargeOnPlan", { amount: money(r.amount), date: day(r.since) })}
            {r.next && !r.lapsed ? ` · ${t("loans.rechargeRunsOut", { date: day(r.next) })}` : ""}
          </p>
          {r.lapsed && r.next && (
            <p className="flex items-start gap-1.5 text-13 text-warn-ink">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("loans.rechargeLapsed", { date: day(r.next) })}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <details className="min-w-0">
              <summary className="w-fit cursor-pointer text-13 font-semibold text-ink underline underline-offset-2">
                {t("loans.rechargeHistory", { count: r.count, total: money(r.total) })}
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {r.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap gap-x-3 text-13">
                    <span className="w-28 shrink-0 text-ink-muted">{day(p.date)}</span>
                    <span className="min-w-0 flex-1 text-ink">
                      {p.kind === "addOn" ? t("loans.rechargeKindAddOn") : p.days ? t("loans.rechargePlan", { days: p.days }) : t("loans.rechargeKindUnknown")}
                    </span>
                    <span translate="no" className="amount shrink-0 text-ink">
                      -{money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
            <RechargeDays operator={r.operator} price={r.amount} priceLabel={money(r.amount)} days={r.basis === "you" ? r.validityDays : undefined} />
          </div>
        </li>
      ))}
    </ul>
  );
};

export default RechargeList;
