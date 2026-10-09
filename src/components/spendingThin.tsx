"use client";

import { use } from "react";

import { CHART_COLOR_CLASSES } from "@/constants";
import type { SpendBucket } from "@/lib/spending";
import { cn, formatAmount } from "@/lib/utils";

export type AccountSpending = { buckets: SpendBucket[]; total: number; currency: string };
export type SpendingByAccount = Record<string, AccountSpending>;

/**
 * The thinnest form of the spending graph: one bar in the same buckets and
 * colours as the Home doughnut, with the total underneath. Reads the
 * streamed per-account spending and shows the selected account's.
 */
const SpendingThin = ({ spending, accountId }: { spending: Promise<SpendingByAccount>; accountId: string }) => {
  const data = use(spending)[accountId];
  if (!data || data.buckets.length === 0) {
    return (
      <div className="panel px-4 py-3">
        <p className="eyebrow">No spending recorded yet</p>
      </div>
    );
  }

  return (
    <div className="panel px-4 py-3">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        {data.buckets.map((b, i) => (
          <div
            key={b.key}
            title={`${b.name}: ${formatAmount(b.amount, data.currency)} (${Math.round(b.share * 100)}%)`}
            className={cn("h-full", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])}
            style={{ width: `${b.share * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <span className="eyebrow">Total spent</span>
        <span className="amount text-14 font-semibold text-ink">{formatAmount(data.total, data.currency)}</span>
      </div>
    </div>
  );
};

export const SpendingThinSkeleton = () => (
  <div className="panel px-4 py-3" aria-busy="true">
    <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-container" />
    <div className="mt-2.5 flex justify-between">
      <span className="h-3 w-20 animate-pulse rounded bg-surface-container" />
      <span className="h-3 w-24 animate-pulse rounded bg-surface-container" />
    </div>
  </div>
);

export default SpendingThin;
