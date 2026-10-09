"use client";

import { use } from "react";

import { CHART_COLOR_CLASSES } from "@/constants";
import type { SpendBucket } from "@/lib/spending";
import { cn, formatAmount } from "@/lib/utils";

export type AccountSpending = { buckets: SpendBucket[]; total: number; currency: string; period: "month" | "all" };
export type SpendingByAccount = Record<string, AccountSpending>;

/**
 * Sits right under the card: "Spending this month" and the amount on one
 * line, a rounded bar beneath split in the same groups and colours as the
 * Home doughnut. Falls back to all-time spend when the month is empty.
 */
const SpendingThin = ({ spending, accountId }: { spending: Promise<SpendingByAccount>; accountId: string }) => {
  const data = use(spending)[accountId];
  const empty = !data || data.buckets.length === 0;
  const label = data?.period === "month" ? "Spending this month" : "Total spent";

  return (
    <div className="px-1 pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-14 text-ink">{empty ? "No spending yet" : label}</span>
        {!empty && <span className="amount text-16 font-semibold text-ink">{formatAmount(data.total, data.currency)}</span>}
      </div>
      <div className="mt-2 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-surface-container">
        {!empty &&
          data.buckets.map((b, i) => (
            <div
              key={b.key}
              title={`${b.name}: ${formatAmount(b.amount, data.currency)} (${Math.round(b.share * 100)}%)`}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])}
              style={{ width: `${b.share * 100}%` }}
            />
          ))}
      </div>
    </div>
  );
};

export const SpendingThinSkeleton = () => (
  <div className="px-1 pt-1" aria-busy="true">
    <div className="flex justify-between">
      <span className="h-4 w-36 animate-pulse rounded bg-surface-container" />
      <span className="h-4 w-24 animate-pulse rounded bg-surface-container" />
    </div>
    <div className="mt-2 h-2 w-full animate-pulse rounded-full bg-surface-container" />
  </div>
);

export default SpendingThin;
