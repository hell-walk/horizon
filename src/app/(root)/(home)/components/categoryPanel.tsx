import { chartColorClass, spendTypeLabel } from "@/constants";
import { getT } from "@/lib/i18n/server";
import { PEOPLE_GROUP } from "@/lib/payees";
import { groupBySpendType, splitUpi } from "@/lib/spending";
import { cn, formatAmount } from "@/lib/utils";

import CategoryChartLink from "./categoryChartLink";

// Concentric arcs: one ring per spending category for the selected account.
const CategoryPanel = async ({
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
  const t = await getT();
  // Same buckets, order and colours as the strip under the bank card.
  const categories = groupBySpendType(transactions, 5);
  const upi = splitUpi(transactions);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{t("home.spendingTitle")}</span>
        </div>
        {accountName && (
          <span translate="no" className="eyebrow truncate">
            {accountName}
          </span>
        )}
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        {categories.length > 0 ? (
          <CategoryChartLink items={categories} currency={currency} total={total} href={href} />
        ) : (
          <div className="relative mx-auto size-[180px] md:size-[200px]">
            <div className="size-full rounded-full border-[14px] border-surface-container" />
            <div className="pointer-events-none absolute inset-0 flex-center flex-col px-8 text-center">
              <span className="eyebrow">{t("home.spent")}</span>
              <span translate="no" className="amount text-16 font-semibold text-ink">
                {formatAmount(total, currency)}
              </span>
            </div>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-line">
          {categories.map((category, i) => (
            <li key={category.name} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", chartColorClass(category.name, i))} />
                  <span className="truncate text-14 font-semibold text-ink">{spendTypeLabel(t, category.name)}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span translate="no" className="amount text-14 font-semibold text-ink">
                    {formatAmount(category.amount, currency)}
                  </span>
                  <span className="eyebrow">{Math.round(category.share * 100)}%</span>
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-surface-container">
                <div
                  className={cn("bar-grow h-1 rounded-full", chartColorClass(category.name, i))}
                  style={{ width: `${Math.max(category.share * 100, 2)}%`, animationDelay: `${150 + i * 90}ms` }}
                />
              </div>
              {category.name === PEOPLE_GROUP && (upi.people.count > 0 || upi.shops.count > 0) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 pl-[22px]">
                  {upi.people.count > 0 && (
                    <span className="text-12 text-ink-muted">
                      {t("home.toPeople")}{" "}
                      <span translate="no" className="amount font-semibold text-ink">
                        {formatAmount(upi.people.amount, currency)}
                      </span>
                      <span className="eyebrow"> ×{upi.people.count}</span>
                    </span>
                  )}
                  {upi.shops.count > 0 && (
                    <span className="text-12 text-ink-muted">
                      {t("home.toShops")}{" "}
                      <span translate="no" className="amount font-semibold text-ink">
                        {formatAmount(upi.shops.amount, currency)}
                      </span>
                      <span className="eyebrow"> ×{upi.shops.count}</span>
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
          {categories.length === 0 && <li className="py-3 text-14 text-ink-muted">{t("home.spendingEmpty")}</li>}
        </ul>
      </div>
    </section>
  );
};

export default CategoryPanel;
