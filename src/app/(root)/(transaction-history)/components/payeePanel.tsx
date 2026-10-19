"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { ArrowUpRight, List, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Doughnut } from "react-chartjs-2";

import ChartCentre from "@/components/chartCentre";
import { useT } from "@/components/i18nProvider";
import { chartColorClass } from "@/constants";
import { ENTRANCE, segmentColor, useChartColors } from "@/lib/chartColors";
import { PEOPLE_GROUP, payeeName, type PayeeSpend } from "@/lib/payees";
import { spendSlug } from "@/lib/spendSlug";
import { cn, formatAmount, formatDateTime } from "@/lib/utils";

import UpiBreakdown from "./upiBreakdown";
import { dataLabel } from "@/lib/i18n/labels";

ChartJS.register(ArcElement, Tooltip);

const ALL = "__all__";

// Group and category names that lib/spending and lib/payees produce in English
// ("UPI payments", "Other", "Food"...) show in the chosen language when there
const bucketLabel = dataLabel;

/**
 * Where the money went: one slice per kind of spending (Food, UPI payments,
 * Bills & recharges, EMI & pay later...), the same as Home's chart. A slice or
 * a row opens that kind's own page (the full analysis for subscribers); the
 * folded "Other" lists its payments underneath, and "View all" lists every
 * payment. Without `accountId` the slices only list (one slice per payee).
 */
const PayeePanel = ({ groups, currency, arrive = false, accountId }: { groups: PayeeSpend[]; currency?: string; arrive?: boolean; accountId?: string }) => {
  const t = useT();
  const router = useRouter();
  // "Other" is the tail of several kinds folded together: no page of its own.
  const opens = (g: PayeeSpend) => Boolean(accountId) && g.name !== "Other";
  const choose = (g: PayeeSpend) => {
    if (opens(g)) router.push(`/spending/${spendSlug(g.name)}?id=${accountId}`);
    else setSelected((current) => (current === g.key ? null : g.key));
  };
  const colors = useChartColors();
  const [selected, setSelected] = useState<string | null>(null);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const count = groups.reduce((s, g) => s + g.count, 0);
  const showAll = selected === ALL;
  const active = groups.find((g) => g.key === selected) ?? null;

  // Rows for the list under the chart: one payee's payments, or all of them.
  const listed = showAll
    ? groups.flatMap((g) => g.transactions.map((tx) => ({ tx, payee: tx.shownName || payeeName(tx.name || "") }))) // own name, even inside "Other"
    : active
      ? active.transactions.map((tx) => ({ tx, payee: active.name }))
      : [];
  listed.sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());

  const data = {
    labels: groups.map((g) => bucketLabel(t, g.name)),
    datasets: [
      {
        data: groups.map((g) => g.amount),
        backgroundColor: groups.map((g, i) => (active && g.key !== active.key ? colors.track : segmentColor(colors, g.name, i))),
        borderColor: colors.card,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{t("history.whereItGoes")}</span>
          <span className="eyebrow">{t(accountId ? "history.byType" : "history.byPayee")}</span>
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(showAll ? null : ALL)}
            aria-pressed={showAll}
            className={cn("btn-sm -mr-2", showAll ? "btn-primary" : "btn-secondary")}
          >
            <List className="size-3.5" /> {showAll ? t("history.hideList") : t("history.viewAll", { count })}
          </button>
        )}
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className={cn("relative mx-auto size-[200px] md:size-[220px]", arrive && "chart-arrive")}>
          {groups.length > 0 ? (
            <Doughnut
              role="img"
              aria-label={t("history.chartLabel", { list: groups.map((g) => `${bucketLabel(t, g.name)} ${Math.round(g.share * 100)}%`).join(", ") })}
              data={data}
              options={{
                cutout: "62%",
                maintainAspectRatio: false,
                animation: ENTRANCE,
                onClick: (_, elements) => {
                  const index = elements[0]?.index;
                  if (index !== undefined) choose(groups[index]);
                },
                onHover: (event, elements) => {
                  const target = event.native?.target as HTMLElement | null;
                  if (target) target.style.cursor = elements.length ? "pointer" : "default";
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: colors.text,
                    titleColor: colors.card,
                    bodyColor: colors.card,
                    displayColors: false,
                    callbacks: {
                      label: (item) => {
                        const g = groups[item.dataIndex];
                        return `${formatAmount(g.amount, currency)} · ${t("history.payments", { count: g.count })}`;
                      },
                    },
                  },
                },
              }}
            />
          ) : (
            <div className="size-full rounded-full border-14 border-surface-container" />
          )}
          <ChartCentre className="pointer-events-none absolute inset-0 flex-center flex-col px-10 text-center">
            <span translate={active ? "no" : undefined} className="eyebrow">
              {active ? bucketLabel(t, active.name) : showAll ? t("history.allPayments") : t("history.spent")}
            </span>
            <span translate="no" className="amount text-16 font-semibold text-ink">
              {formatAmount(active ? active.amount : total, currency)}
            </span>
            {active && <span className="eyebrow">{t("history.shareOfSpending", { percent: Math.round(active.share * 100) })}</span>}
            {!active && groups.length > 0 && (
              <span className="eyebrow">{showAll ? t("history.payments", { count }) : t(accountId ? "history.tapForAnalysis" : "history.tapSlice")}</span>
            )}
          </ChartCentre>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {groups.map((g, i) => {
            const isActive = g.key === selected;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => choose(g)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-surface-low",
                    isActive && "bg-surface-low",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn("size-2.5 shrink-0 rounded-sm", chartColorClass(g.name, i))} />
                    <span className="flex min-w-0 flex-col">
                      <span translate="no" className="truncate text-14 font-semibold text-ink">
                        {bucketLabel(t, g.name)}
                      </span>
                      <span className="eyebrow">{t("history.payments", { count: g.count })}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span translate="no" className="amount text-14 font-semibold text-ink">
                      {formatAmount(g.amount, currency)}
                    </span>
                    <span className="eyebrow w-9 text-right">{Math.round(g.share * 100)}%</span>
                    {opens(g) && <ArrowUpRight className="size-3.5 shrink-0 self-center text-ink-muted" aria-hidden />}
                  </span>
                </button>
              </li>
            );
          })}
          {groups.length === 0 && <li className="py-3 text-14 text-ink-muted">{t("history.noSpending")}</li>}
        </ul>
      </div>

      {(active || showAll) && (
        <div className="border-t border-line">
          <div className="flex items-center justify-between bg-surface-low px-4 py-2.5">
            <span className="eyebrow">
              {active ? <span translate="no">{bucketLabel(t, active.name)}</span> : t("history.allPayees")} · {t("history.payments", { count: listed.length })}
            </span>
            <button type="button" onClick={() => setSelected(null)} className="btn-ghost btn-sm -mr-2" aria-label={t("history.clearSelection")}>
              <X className="size-3.5" /> {t("history.clear")}
            </button>
          </div>
          {active?.name === PEOPLE_GROUP ? (
            <UpiBreakdown transactions={active.transactions} currency={currency} />
          ) : (
            <ul className="divide-y divide-line">
              {listed.map(({ tx, payee }) => (
                <li key={tx.id} className="row-debit flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span translate="no" className="truncate text-14 font-semibold text-ink">
                      {tx.name}
                    </span>
                    <span className="eyebrow">
                      <span translate="no">{formatDateTime(new Date(tx.date)).dateOnly}</span> ·{" "}
                      {showAll ? <span translate="no">{bucketLabel(t, payee)}</span> : bucketLabel(t, tx.category || "Other")}
                    </span>
                  </span>
                  <span translate="no" className="amount shrink-0 text-14 font-semibold text-danger">
                    -{formatAmount(Math.abs(Number(tx.amount) || 0), tx.currency ?? currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default PayeePanel;
