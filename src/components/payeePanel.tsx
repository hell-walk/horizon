"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { List, X } from "lucide-react";
import { useState } from "react";
import { Doughnut } from "react-chartjs-2";

import { chartColorClass } from "@/constants";
import { ENTRANCE, segmentColor, useChartColors } from "@/lib/chartColors";
import { payeeName, type PayeeSpend } from "@/lib/payees";
import { cn, formatAmount, formatDateTime } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip);

const ALL = "__all__";

/**
 * Where the money went: one slice per payee, repeats grouped. Click a slice
 * or a row to list that payee's payments underneath, or "View all" to list
 * every payment with its payee.
 */
const PayeePanel = ({ groups, currency, arrive = false }: { groups: PayeeSpend[]; currency?: string; arrive?: boolean }) => {
  const colors = useChartColors();
  const [selected, setSelected] = useState<string | null>(null);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const count = groups.reduce((s, g) => s + g.count, 0);
  const showAll = selected === ALL;
  const active = groups.find((g) => g.key === selected) ?? null;

  // Rows for the list under the chart: one payee's payments, or all of them.
  const listed = showAll
    ? groups.flatMap((g) => g.transactions.map((t) => ({ t, payee: payeeName(t.name || "") }))) // own name, even inside "Other"
    : active
      ? active.transactions.map((t) => ({ t, payee: active.name }))
      : [];
  listed.sort((a, b) => new Date(b.t.date).getTime() - new Date(a.t.date).getTime());

  const data = {
    labels: groups.map((g) => g.name),
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
          <span className="eyebrow">Where it goes</span>
          <span className="eyebrow text-ink">{"// by payee"}</span>
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(showAll ? null : ALL)}
            aria-pressed={showAll}
            className={cn("btn-sm -mr-2", showAll ? "btn-primary" : "btn-secondary")}
          >
            <List className="size-3.5" /> {showAll ? "Hide list" : `View all ${count}`}
          </button>
        )}
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className={cn("relative mx-auto size-[200px] md:size-[220px]", arrive && "chart-arrive")}>
          {groups.length > 0 ? (
            <Doughnut
              data={data}
              options={{
                cutout: "62%",
                maintainAspectRatio: false,
                animation: ENTRANCE,
                onClick: (_, elements) => {
                  const index = elements[0]?.index;
                  if (index === undefined) return;
                  const key = groups[index].key;
                  setSelected((current) => (current === key ? null : key));
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
                        return `${formatAmount(g.amount, currency)} · ${g.count} ${g.count === 1 ? "payment" : "payments"}`;
                      },
                    },
                  },
                },
              }}
            />
          ) : (
            <div className="size-full rounded-full border-[14px] border-surface-container" />
          )}
          <div className="pointer-events-none absolute inset-0 flex-center flex-col px-10 text-center">
            <span className="eyebrow">{active ? active.name : showAll ? "All payments" : "Spent"}</span>
            <span className="amount text-16 font-semibold text-ink">{formatAmount(active ? active.amount : total, currency)}</span>
            {active && <span className="eyebrow">{Math.round(active.share * 100)}% of spend</span>}
            {!active && groups.length > 0 && <span className="eyebrow">{showAll ? `${count} payments` : "Tap a slice"}</span>}
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {groups.map((g, i) => {
            const isActive = g.key === selected;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => setSelected(isActive ? null : g.key)}
                  className={cn("flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-surface-low", isActive && "bg-surface-low")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn("size-2.5 shrink-0 rounded-sm", chartColorClass(g.name, i))} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-14 font-semibold text-ink">{g.name}</span>
                      <span className="eyebrow">
                        {g.count} {g.count === 1 ? "payment" : "payments"}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="amount text-14 font-semibold text-ink">{formatAmount(g.amount, currency)}</span>
                    <span className="eyebrow w-9 text-right">{Math.round(g.share * 100)}%</span>
                  </span>
                </button>
              </li>
            );
          })}
          {groups.length === 0 && <li className="py-3 text-14 text-ink-muted">No spending on this account yet.</li>}
        </ul>
      </div>

      {(active || showAll) && (
        <div className="border-t border-line">
          <div className="flex items-center justify-between bg-surface-low px-4 py-2.5">
            <span className="eyebrow">
              {active ? active.name : "All payees"} {"// "}
              {listed.length} {listed.length === 1 ? "payment" : "payments"}
            </span>
            <button type="button" onClick={() => setSelected(null)} className="btn-ghost btn-sm -mr-2" aria-label="Clear selection">
              <X className="size-3.5" /> Clear
            </button>
          </div>
          <ul className="divide-y divide-line">
            {listed.map(({ t, payee }) => (
              <li key={t.id} className="row-debit flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-14 font-semibold text-ink">{t.name}</span>
                  <span className="eyebrow">
                    {formatDateTime(new Date(t.date)).dateOnly} · {showAll ? payee : t.category || "Other"}
                  </span>
                </span>
                <span className="amount shrink-0 text-14 font-semibold text-danger">-{formatAmount(Math.abs(Number(t.amount) || 0), t.currency ?? currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default PayeePanel;
