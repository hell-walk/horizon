"use client";

import { BarChart3, List } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useT } from "@/components/i18nProvider";
import { cn } from "@/lib/utils";

import MonthlyChart, { type MonthBar } from "./monthlyChart";

/**
 * The month-by-month panel's two views: the list (rendered by the server and
 * passed in) and the paired bars. The choice is per visit; the list is the
 * one screen readers get either way.
 */
const MonthlyFlowView = ({ list, months, currency }: { list: ReactNode; months: MonthBar[]; currency?: string }) => {
  const t = useT();
  const [view, setView] = useState<"list" | "chart">("list");
  const option = (key: "list" | "chart", Icon: typeof List, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={view === key}
      onClick={() => setView(key)}
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-12 font-semibold transition-colors",
        view === key ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {label}
    </button>
  );

  return (
    <>
      <div className="flex justify-end border-b border-line px-4 py-2">
        <div role="radiogroup" aria-label={t("history.monthView")} className="flex gap-1 rounded-md border border-line bg-card p-1">
          {option("list", List, t("history.monthViewList"))}
          {option("chart", BarChart3, t("history.monthViewChart"))}
        </div>
      </div>
      {view === "chart" ? <MonthlyChart months={months} currency={currency} /> : list}
    </>
  );
};

export default MonthlyFlowView;
