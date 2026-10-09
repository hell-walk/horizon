import { CHART_COLOR_CLASSES } from "@/constants";
import { cn, formatAmount, sumTransactionCategories } from "@/lib/utils";

import CategoryChartLink from "./categoryChartLink";

// Concentric arcs: one ring per spending category for the selected account.
const CategoryPanel = ({
  transactions = [],
  currency,
  accountName,
  href,
}: {
  transactions?: Transaction[];
  currency?: string;
  accountName?: string;
  href: string; // the full breakdown the chart opens
}) => {
  const categories = sumTransactionCategories(transactions, 5);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Spending</span>
          <span className="eyebrow text-ink">{"// by category"}</span>
        </div>
        {accountName && <span className="eyebrow truncate">{accountName}</span>}
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        {categories.length > 0 ? (
          <CategoryChartLink items={categories} currency={currency} total={total} href={href} />
        ) : (
          <div className="relative mx-auto size-[180px] md:size-[200px]">
            <div className="size-full rounded-full border-[14px] border-surface-container" />
            <div className="pointer-events-none absolute inset-0 flex-center flex-col px-8 text-center">
              <span className="eyebrow">Spent</span>
              <span className="amount text-16 font-semibold text-ink">{formatAmount(total, currency)}</span>
            </div>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-line">
          {categories.map((category, i) => (
            <li key={category.name} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])} />
                  <span className="truncate text-14 font-semibold text-ink">{category.name}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="amount text-14 font-semibold text-ink">{formatAmount(category.amount, currency)}</span>
                  <span className="eyebrow">{Math.round(category.share * 100)}%</span>
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-surface-container">
                <div
                  className={cn("h-1 rounded-full", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])}
                  style={{ width: `${Math.max(category.share * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="py-3 text-14 text-ink-muted">No spending recorded for this account yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
};

export default CategoryPanel;
