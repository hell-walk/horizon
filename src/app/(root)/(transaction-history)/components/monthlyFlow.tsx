import { CalendarX } from "lucide-react";

import { monthlyFlow, type MonthFlow } from "@/lib/cashflow";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { dataLabel } from "@/lib/i18n/labels";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn, formatAmount } from "@/lib/utils";

const SHOWN = 6; // months shown before "older months"

/**
 * Month by month: money in, money out, what was left, and where most of it
 * went. Bars compare months at a glance; the numbers beside them say it all
 * in words, so the bars are hidden from screen readers.
 */
const MonthlyFlow = async ({ transactions, currency }: { transactions: Transaction[]; currency?: string }) => {
  const months = monthlyFlow(transactions);
  if (months.length === 0) return null;

  const t = await getT();
  const locale = await getLocale();
  const monthName = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", year: "numeric", timeZone: "UTC" });
  const dayName = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short", timeZone: "UTC" });
  const label = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));
  const day = (date: string) => dayName.format(new Date(`${date}T00:00:00Z`));

  const thisMonth = new Date().toISOString().slice(0, 7);
  const oldest = months[months.length - 1];
  const biggest = Math.max(1, ...months.map((m) => Math.max(m.moneyIn, m.moneyOut)));

  const row = (m: MonthFlow) => (
    <li key={m.month} className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[180px_1fr_1fr] md:items-center md:gap-4">
      <div className="flex flex-col">
        <span className="text-14 font-semibold text-ink">{label(m.month)}</span>
        {m.month === thisMonth && m.entries > 0 && <span className="eyebrow">{t("history.monthSoFar")}</span>}
        {m === oldest && m.from && Number(m.from.slice(8)) > 3 && <span className="eyebrow">{t("history.monthFrom", { date: day(m.from) })}</span>}
      </div>

      {m.entries === 0 ? (
        <p className="flex items-center gap-2 text-13 text-warn-ink md:col-span-2">
          <CalendarX className="size-4 shrink-0" aria-hidden /> {t("history.monthEmpty")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <Line label={t("history.monthIn")} amount={m.moneyIn} share={m.moneyIn / biggest} tone="success" currency={currency} />
            <Line label={t("history.monthOut")} amount={m.moneyOut} share={m.moneyOut / biggest} tone="danger" currency={currency} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-13">
              <span className="text-ink-muted">{m.left < 0 ? t("history.monthOverspent") : t("history.monthLeft")}: </span>
              <span translate="no" className={cn("amount font-semibold", m.left < 0 ? "text-danger" : "text-success")}>
                {m.left < 0 ? "-" : "+"}
                {formatAmount(Math.abs(m.left), currency)}
              </span>
            </p>
            {m.topSpending.length > 0 && <TopSpending t={t} items={m.topSpending} currency={currency} />}
          </div>
        </>
      )}
    </li>
  );

  const recent = months.slice(0, SHOWN);
  const older = months.slice(SHOWN);

  return (
    <section className="panel" aria-labelledby="months-title">
      <header className="panel-head block space-y-1">
        <h2 id="months-title" className="eyebrow text-ink">
          {t("history.monthTitle")}
        </h2>
        <p className="text-13 text-ink-muted">{t("history.monthHint")}</p>
      </header>
      <ul className="divide-y divide-line">{recent.map(row)}</ul>
      {older.length > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-3 text-13 font-semibold text-ink underline underline-offset-2">
            {t("history.monthOlder", { count: older.length })}
          </summary>
          <ul className="divide-y divide-line border-t border-line">{older.map(row)}</ul>
        </details>
      )}
    </section>
  );
};

const Line = ({ label, amount, share, tone, currency }: { label: string; amount: number; share: number; tone: "success" | "danger"; currency?: string }) => (
  <div className="grid grid-cols-[44px_1fr_auto] items-center gap-2 text-13">
    <span className="text-ink-muted">{label}</span>
    <span className="h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden>
      <span
        className={cn("block h-full rounded-full", tone === "success" ? "bg-success" : "bg-danger")}
        style={{ width: `${Math.max(share * 100, amount ? 2 : 0)}%` }}
      />
    </span>
    <span translate="no" className={cn("amount text-right font-semibold", tone === "success" ? "text-success" : "text-danger")}>
      {formatAmount(amount, currency)}
    </span>
  </div>
);

const TopSpending = ({ t, items, currency }: { t: Translate; items: MonthFlow["topSpending"]; currency?: string }) => (
  <p className="text-12 text-ink-muted">
    {t("history.monthTop")}{" "}
    {items.map((item, i) => (
      <span key={item.name}>
        {i > 0 && " · "}
        <span className="text-ink">{dataLabel(t, item.name)}</span>{" "}
        <span translate="no" className="amount">
          {formatAmount(item.amount, currency)}
        </span>
      </span>
    ))}
  </p>
);

export default MonthlyFlow;
