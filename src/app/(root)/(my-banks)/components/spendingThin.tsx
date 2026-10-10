"use client";

import { use } from "react";

import { useT } from "@/components/i18nProvider";
import { chartColorClass } from "@/constants";
import type { SpendBucket } from "@/lib/spending";
import { cn, formatAmount } from "@/lib/utils";
import { dataLabel } from "@/lib/i18n/labels";

export type AccountSpending = { buckets: SpendBucket[]; total: number; currency: string; period: "month" | "all" };
export type SpendingByAccount = Record<string, AccountSpending>;

const bucketLabel = dataLabel;

/**
 * Sits right under the card: "Spending this month" and the amount on one
 * line, a rounded bar beneath split in the same groups and colours as the
 * Home doughnut. Falls back to all-time spend when the month is empty.
 */
const SpendingThin = ({ spending, accountId }: { spending: Promise<SpendingByAccount>; accountId: string }) => {
  const t = useT();
  const data = use(spending)[accountId];
  const empty = !data || data.buckets.length === 0;
  const label = data?.period === "month" ? t("banks.spentThisMonth") : t("banks.totalSpent");

  return (
    <div className="px-1 pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-14 text-ink">{empty ? t("banks.noSpending") : label}</span>
        {!empty && (
          <span translate="no" className="amount text-16 font-semibold text-ink">
            {formatAmount(data.total, data.currency)}
          </span>
        )}
      </div>
      <div key={accountId} className="bar-reveal mt-2 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-surface-container">
        {!empty &&
          data.buckets.map((b, i) => (
            <div
              key={b.key}
              title={t("banks.spendShare", { name: bucketLabel(t, b.name), amount: formatAmount(b.amount, data.currency), percent: Math.round(b.share * 100) })}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", chartColorClass(b.name, i))}
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
