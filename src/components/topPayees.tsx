import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CHART_COLOR_CLASSES } from "@/constants";
import { groupByPayee } from "@/lib/payees";
import { cn, formatAmount } from "@/lib/utils";

/**
 * Home summary: the four payees that take the most, as a ratio bar and a
 * list. The full, clickable breakdown lives on the Transaction History page.
 */
const TopPayees = ({ transactions = [], currency, appwriteItemId }: { transactions?: Transaction[]; currency?: string; appwriteItemId?: string }) => {
  const groups = groupByPayee(transactions, 5).filter((g) => g.key !== "other").slice(0, 4);
  const shown = groups.reduce((s, g) => s + g.share, 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Top payees</span>
          <span className="eyebrow text-ink">{"// 4 biggest"}</span>
        </div>
        <Link href={`/transaction-history/?id=${appwriteItemId ?? ""}#payees`} className="btn-ghost btn-sm -mr-2">
          Full breakdown <ArrowUpRight className="size-3.5" />
        </Link>
      </header>

      <div className="panel-body flex flex-col gap-4">
        {groups.length === 0 ? (
          <p className="text-14 text-ink-muted">No spending on this account yet.</p>
        ) : (
          <>
            {/* One bar, split in the ratio of the four payees; the grey tail is everyone else. */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container">
              {groups.map((g, i) => (
                <div
                  key={g.key}
                  title={`${g.name} ${Math.round(g.share * 100)}%`}
                  className={cn("h-full", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])}
                  style={{ width: `${g.share * 100}%` }}
                />
              ))}
            </div>

            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {groups.map((g, i) => (
                <li key={g.key} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2.5 shrink-0 rounded-sm", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])} />
                    <span className="truncate text-14 font-semibold text-ink">{g.name}</span>
                    <span className="eyebrow">×{g.count}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="amount text-14 font-semibold text-ink">{formatAmount(g.amount, currency)}</span>
                    <span className="eyebrow w-9 text-right">{Math.round(g.share * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>

            {shown < 0.999 && <p className="eyebrow">These four are {Math.round(shown * 100)}% of spending; the rest is spread across smaller payees.</p>}
          </>
        )}
      </div>
    </section>
  );
};

export default TopPayees;
