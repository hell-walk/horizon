import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { chartColorClass } from "@/constants";
import { groupBySpendType } from "@/lib/spending";
import { cn, formatAmount } from "@/lib/utils";

/**
 * Short spending summary under the bank card: one bar split in the same
 * buckets, order and colours as the Home doughnut, with a two-column key.
 */
const SpendingStrip = ({ transactions = [], currency, href }: { transactions?: Transaction[]; currency?: string; href: string }) => {
  const buckets = groupBySpendType(transactions, 5);
  if (buckets.length === 0) return null;
  const total = buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="eyebrow">Spent</span>
        <Link href={href} className="flex items-baseline gap-1.5 text-ink hover:underline" aria-label="Open the full spending breakdown">
          <span className="amount text-14 font-semibold">{formatAmount(total, currency)}</span>
          <ArrowUpRight className="size-3.5 self-center text-ink-faint" />
        </Link>
      </div>

      <div className="bar-reveal flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
        {buckets.map((b, i) => (
          <div
            key={b.key}
            title={`${b.name}: ${formatAmount(b.amount, currency)} (${Math.round(b.share * 100)}%)`}
            className={cn("h-full", chartColorClass(b.name, i))}
            style={{ width: `${b.share * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {buckets.map((b, i) => (
          <li key={b.key} className="flex min-w-0 items-center justify-between gap-2" title={formatAmount(b.amount, currency)}>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-sm", chartColorClass(b.name, i))} />
              <span className="truncate text-12 text-ink">{b.name}</span>
            </span>
            <span className="eyebrow shrink-0">{Math.round(b.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SpendingStrip;
