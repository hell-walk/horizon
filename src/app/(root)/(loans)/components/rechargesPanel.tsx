import { Smartphone } from "lucide-react";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import { rechargesForOwner } from "@/lib/server/recharges";
import { cn, formatAmount } from "@/lib/utils";

/**
 * Recharges, under the subscriptions: prepaid mobile and DTH top-ups by
 * operator, what each costs, how often it comes back, and about how much a
 * month that is. Read by the operator's name, so a single recharge shows too.
 */
const RechargesPanel = async ({ ownerId }: { ownerId: string }) => {
  const [picture, t, locale] = await Promise.all([rechargesForOwner(ownerId), getT(), getLocale()]);
  const money = (n: number) => formatAmount(Math.round(n), picture.currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="recharges-title">
      <header className="flex flex-col gap-1">
        <h2 id="recharges-title" className="eyebrow flex items-center gap-2">
          <Smartphone className="size-3.5" aria-hidden /> {t("loans.rechargeTitle")}
        </h2>
        <p className="text-13 text-ink-muted">{t("loans.rechargeIntro")}</p>
      </header>

      {picture.items.length === 0 ? (
        <p className="panel panel-body text-14 text-ink-muted">{t("loans.rechargeNone")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile label={t("loans.subsTileMonthly")} value={picture.monthly > 0 ? money(picture.monthly) : "—"} note={t("loans.rechargeTileMonthlyNote")} />
            <Tile label={t("loans.subsTilePaid")} value={money(picture.total)} note={t("loans.rechargeTileCount", { count: picture.count })} />
          </div>
          <ul className="flex flex-col gap-2">
            {picture.items.map((r) => (
              <li key={r.operator} className="panel flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span translate="no" className="text-16 font-semibold text-ink">
                    {r.operator}
                  </span>
                  {r.everyDays ? (
                    <span className="chip">{t("loans.rechargeEvery", { days: r.everyDays })}</span>
                  ) : (
                    <span className="chip">{t("loans.rechargeOnce")}</span>
                  )}
                  <span translate="no" className={cn("amount ml-auto text-16 font-semibold text-danger")}>
                    {money(r.amount)}
                  </span>
                </div>
                <p className="text-13 text-ink-muted">
                  {t("loans.rechargeLine", { count: r.count, total: money(r.total) })}
                  {r.perMonth ? ` · ${t("loans.rechargePerMonth", { amount: money(r.perMonth) })}` : ""}
                  {` · ${t("loans.rechargeLast", { date: day(r.last) })}`}
                  {r.next ? ` · ${t("loans.rechargeNext", { date: day(r.next) })}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

const Tile = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <p className="eyebrow">{label}</p>
    <p translate="no" className="amount text-20 font-semibold text-ink">
      {value}
    </p>
    <p className="eyebrow">{note}</p>
  </article>
);

export default RechargesPanel;
