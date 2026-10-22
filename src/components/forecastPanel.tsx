import { AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import type { AccountForecast } from "@/lib/server/forecast";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

const EVENTS_SHOWN = 5;

/**
 * "Will I have enough money?" for one account: where the balance is heading
 * over the next 30 days, the lowest point, the payments that move it, and
 * how the estimate was made. The chart is a picture of the same numbers; the
 * words carry everything, so the chart is hidden from screen readers.
 */
const ForecastPanel = async ({ result, compact = false }: { result: AccountForecast; compact?: boolean }) => {
  const t = await getT();
  const locale = await getLocale();
  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const weekday = dateFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const { account, forecast: f } = result;
  const money = (n: number) => formatAmount(Math.abs(n), account.currency);
  const signed = (n: number) => `${n < 0 ? "-" : ""}${money(n)}`;
  const today = new Date().toISOString().slice(0, 10);

  const header = (
    <header className="panel-head">
      <h2 className="eyebrow flex items-center gap-2">
        <TrendingUp className="size-3.5" aria-hidden /> {t("bills.fcTitle")}
      </h2>
      <span translate="no" className="eyebrow">
        {account.name} {maskLabel(account.mask)}
      </span>
    </header>
  );

  if (!f.ok) {
    const message =
      f.reason === "noBalance"
        ? t("bills.fcNoBalance")
        : f.reason === "oldStatements"
          ? t("bills.fcOld", { date: dateFormat(locale, { day: "numeric", month: "short", year: "numeric" })(f.lastDate!) })
          : t("bills.fcNoHistory");
    return (
      <section className="panel">
        {header}
        <p className="px-4 py-3 text-14 text-ink-muted">{message}</p>
      </section>
    );
  }

  const upcoming = f.events.filter((e) => e.date >= today).slice(0, EVENTS_SHOWN);
  // Every day drawn: the month so far (month view), the known balance, then the estimate.
  const drawn = [...f.history, f.start, ...f.points];
  const from = drawn[0].date;
  // Where today falls along the chart, in percent (the known balance can be before today for uploaded statements).
  const todayIndex = drawn.findIndex((p) => p.date >= today);
  const todayAt = todayIndex > 0 ? (todayIndex / (drawn.length - 1)) * 100 : 0;

  return (
    <section className="panel">
      {header}
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="text-14 text-ink">
          {t("bills.fcEnd", { date: day(f.end.date) })}{" "}
          <span translate="no" className={cn("amount text-20 font-semibold", f.end.balance < 0 ? "text-danger" : "text-ink")}>
            {signed(f.end.balance)}
          </span>
        </p>

        {f.belowZero ? (
          <p className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-14 text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <span>{t("bills.fcBelowZero", { date: day(f.belowZero), lowest: signed(f.lowest.balance), lowestDate: day(f.lowest.date) })}</span>
          </p>
        ) : (
          <p className="text-13 text-ink-muted">{t("bills.fcLowest", { amount: signed(f.lowest.balance), date: day(f.lowest.date) })}</p>
        )}

        <div>
          <Chart drawn={drawn} known={f.history.length} events={f.events} today={today} />
          <div className="relative flex justify-between font-mono text-[11px] text-ink-muted" aria-hidden>
            <span>{day(from)}</span>
            {todayAt > 15 && todayAt < 85 && (
              <span className="absolute -translate-x-1/2" style={{ left: `${todayAt}%` }}>
                {t("bills.fcToday")}
              </span>
            )}
            <span>{day(f.end.date)}</span>
          </div>
        </div>

        {!compact && upcoming.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="eyebrow">{t("bills.fcComing")}</p>
            <ul className="flex flex-col gap-1 text-13">
              {upcoming.map((e, i) => (
                <li key={`${e.date}-${i}`} className="flex justify-between gap-3">
                  <span>
                    <span className="text-ink-muted">{weekday(e.date)}</span> ·{" "}
                    <span translate="no" className="text-ink">
                      {e.name}
                    </span>
                  </span>
                  <span translate="no" className={cn("amount shrink-0 font-semibold", e.amount < 0 ? "text-danger" : "text-success")}>
                    {e.amount < 0 ? "-" : "+"}
                    {money(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="text-13 text-ink-muted">
          <summary className="cursor-pointer underline underline-offset-2">{t("bills.fcHow")}</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {f.view === "month" && <li>{t("bills.fcHowMonth", { from: day(from), to: day(f.end.date) })}</li>}
            {f.view === "payday" && <li>{t("bills.fcHowPayDay", { from: day(from), to: day(f.end.date) })}</li>}
            <li>
              {t("bills.fcHowStart", { amount: signed(f.start.balance), date: day(f.start.date) })}
              {f.start.date < today ? ` ${t("bills.fcHowStatementEnd")}` : ""}
            </li>
            <li>
              {t("bills.fcHowDaily", { amount: money(f.dailySpend), days: f.historyDays })}
              {f.leftOut > 0 ? ` ${t("bills.fcHowLeftOut", { count: f.leftOut })}` : ""}
            </li>
            <li>{t("bills.fcHowRegular")}</li>
            <li>{t("bills.fcHowIrregular")}</li>
          </ul>
        </details>

        {compact && (
          <Link href="/bills" className="w-fit text-13 font-semibold text-ink underline underline-offset-2">
            {t("bills.fcSeeBills")}
          </Link>
        )}
      </div>
    </section>
  );
};

/**
 * The balance line: what has already happened (solid) up to the known balance,
 * then the estimate (dashed when there is a past to tell it from); zero marked,
 * today marked, payments as dots.
 */
const Chart = ({
  drawn: all,
  known,
  events,
  today,
}: {
  drawn: { date: string; balance: number }[];
  /** How many of the days drawn have already happened (the index of the known balance). */
  known: number;
  events: { date: string; amount: number }[];
  today: string;
}) => {
  if (all.length < 2) return null;
  const W = 600;
  const H = 140;
  const pad = 6;
  const values = all.map((p) => p.balance);
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const span = top - bottom || 1;
  const x = (i: number) => pad + (i / (all.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + ((top - v) / span) * (H - pad * 2);
  const at = (p: { balance: number }, i: number) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`;
  const line = all.map(at).join(" ");
  const area = `${x(0)},${y(0)} ${line} ${x(all.length - 1)},${y(0)}`;
  const past = all
    .slice(0, known + 1)
    .map(at)
    .join(" ");
  const ahead = all
    .slice(known)
    .map((p, i) => at(p, i + known))
    .join(" ");
  const todayIndex = all.findIndex((p) => p.date >= today);
  const index = new Map(all.map((p, i) => [p.date, i]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
      <polygon points={area} className="fill-lime/20" />
      {bottom < 0 && (
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="stroke-danger" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      {todayIndex > 0 && (
        <line
          x1={x(todayIndex)}
          x2={x(todayIndex)}
          y1={pad}
          y2={H - pad}
          className="stroke-ink-faint"
          strokeDasharray="2 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={ahead}
        fill="none"
        className="stroke-ink"
        strokeWidth={2}
        strokeDasharray={known > 0 ? "6 4" : undefined}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      {known > 0 && (
        <>
          <polyline points={past} fill="none" className="stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <circle cx={x(known)} cy={y(all[known].balance)} r={3.5} className="fill-ink" />
        </>
      )}
      {events.map((e, i) => {
        const i2 = index.get(e.date);
        if (i2 === undefined) return null;
        return <circle key={i} cx={x(i2)} cy={y(all[i2].balance)} r={3.5} className={e.amount < 0 ? "fill-danger" : "fill-success"} />;
      })}
    </svg>
  );
};

export default ForecastPanel;
