import { CalendarRange } from "lucide-react";

import { dataLabel } from "@/lib/i18n/labels";
import { getLocale, getT } from "@/lib/i18n/server";
import type { WeekRecap } from "@/lib/recap";
import { dateFormat } from "@/lib/regularText";
import { cn, formatAmount } from "@/lib/utils";

/**
 * "Your week": money in and out over the last seven days the entries cover,
 * next to a usual week, the biggest spends, and what is due next.
 */
const YourWeek = async ({ recap, currency }: { recap: WeekRecap; currency?: string }) => {
  const t = await getT();
  const locale = await getLocale();
  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const money = (n: number) => formatAmount(Math.abs(n), currency);
  const vsUsual = recap.usualEveryday === undefined ? null : recap.everydayOut - recap.usualEveryday;

  return (
    <section className="panel" aria-labelledby="your-week">
      <header className="panel-head">
        <h2 id="your-week" className="eyebrow flex items-center gap-2 text-ink">
          <CalendarRange className="size-3.5" aria-hidden /> {t("insights.weekTitle")}
        </h2>
        <span className="eyebrow">{t("insights.weekDates", { from: day(recap.from), to: day(recap.to) })}</span>
      </header>
      <div className="flex flex-col gap-3 px-4 py-4 text-14">
        {recap.past && <p className="text-13 text-ink-muted">{t("insights.weekPast", { date: day(recap.to) })}</p>}

        <div className="grid grid-cols-2 gap-3">
          <p className="flex flex-col">
            <span className="eyebrow">{t("insights.weekOut")}</span>
            <span translate="no" className="amount text-18 font-semibold text-danger">
              {money(recap.moneyOut)}
            </span>
          </p>
          <p className="flex flex-col">
            <span className="eyebrow">{t("insights.weekIn")}</span>
            <span translate="no" className="amount text-18 font-semibold text-success">
              {money(recap.moneyIn)}
            </span>
          </p>
        </div>

        <p className="text-13 text-ink">
          {t("insights.weekEveryday", { amount: money(recap.everydayOut) })}{" "}
          {vsUsual !== null && (
            <span className={cn(Math.abs(vsUsual) < recap.usualEveryday! * 0.1 ? "text-ink-muted" : vsUsual > 0 ? "text-danger" : "text-success")}>
              {Math.abs(vsUsual) < recap.usualEveryday! * 0.1
                ? t("insights.weekUsual", { usual: money(recap.usualEveryday!) })
                : t(vsUsual > 0 ? "insights.weekMore" : "insights.weekLess", {
                    difference: money(vsUsual),
                    usual: money(recap.usualEveryday!),
                    count: recap.weeksCompared,
                  })}
            </span>
          )}
        </p>

        {recap.regularOut.length > 0 && (
          <p className="text-13 text-ink">
            {t("insights.weekRegular")} <span translate="no">{recap.regularOut.map((r) => `${r.name} ${money(r.amount)}`).join(", ")}</span>
          </p>
        )}

        {recap.topCategory && (
          <p className="text-13 text-ink">
            {t("insights.weekTop", { category: dataLabel(t, recap.topCategory.name), amount: money(recap.topCategory.amount) })}
          </p>
        )}

        {recap.biggest.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="eyebrow">{t("insights.weekBiggest")}</p>
            <ul className="flex flex-col gap-0.5 text-13" translate="no">
              {recap.biggest.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="text-ink-muted">{day(e.date)}</span> · {e.name}
                  </span>
                  <span className="amount shrink-0 font-semibold text-danger">-{money(e.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-13 text-ink">
          {recap.dueNext.length === 0
            ? t("insights.weekNothingDue")
            : t("insights.weekDue", {
                count: recap.dueNext.length,
                amount: money(recap.dueNext.reduce((s, d) => s + d.amount, 0)),
                names: recap.dueNext.map((d) => d.name).join(", "),
              })}
        </p>
      </div>
    </section>
  );
};

export default YourWeek;
