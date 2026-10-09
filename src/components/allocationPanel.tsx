import Link from "next/link";

import { CHART_COLOR_CLASSES, PROVIDER_LABELS } from "@/constants";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

import { DoughnutChart } from "./DoughnutChartLazy";

// Solid doughnut of balances in the primary currency, with every account listed beside it.
const AllocationPanel = ({ accounts, primaryCurrency }: { accounts: Account[]; primaryCurrency: string }) => {
  const charted = accounts.filter((a) => (a.currency || "USD") === primaryCurrency && a.currentBalance > 0);
  const chartTotal = charted.reduce((sum, a) => sum + a.currentBalance, 0);
  const others = accounts.filter((a) => (a.currency || "USD") !== primaryCurrency);

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Allocation</span>
          <span className="eyebrow text-ink">
            {"// "}{accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </span>
        </div>
        <span className="eyebrow">{primaryCurrency} share</span>
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        <div className="relative mx-auto size-[180px] md:size-[200px]">
          {charted.length > 0 ? (
            <DoughnutChart accounts={charted} />
          ) : (
            <div className="size-full rounded-full border-[14px] border-surface-container" />
          )}
          <div className="pointer-events-none absolute inset-0 flex-center flex-col">
            <span className="eyebrow">Total</span>
            <span className="font-display text-24 font-semibold text-ink">{accounts.length}</span>
            <span className="eyebrow text-ink-muted">{accounts.length === 1 ? "account" : "accounts"}</span>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {charted.map((account, i) => (
            <AllocationRow key={account.appwriteItemId} account={account} share={chartTotal ? account.currentBalance / chartTotal : 0} colorClass={CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length]} />
          ))}
          {others.map((account) => (
            <AllocationRow key={account.appwriteItemId} account={account} colorClass="bg-line" />
          ))}
          {accounts.length === 0 && (
            <li className="py-3 text-14 text-ink-muted">
              Nothing to allocate yet.{" "}
              <Link href="/connect-bank" className="font-semibold text-ink underline underline-offset-4">
                Connect a bank
              </Link>
              .
            </li>
          )}
        </ul>
      </div>
    </section>
  );
};

const AllocationRow = ({ account, share, colorClass }: { account: Account; share?: number; colorClass: string }) => (
  <li>
    <Link
      href={`/transaction-history/?id=${account.appwriteItemId}`}
      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-low"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("size-2.5 shrink-0 rounded-sm", colorClass)} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-14 font-semibold text-ink">{account.name}</span>
          <span className="eyebrow">
            {maskLabel(account.mask)} · {PROVIDER_LABELS[account.provider]?.name ?? "Plaid"}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="amount text-14 font-semibold text-ink">{formatAmount(account.currentBalance, account.currency)}</span>
        {share !== undefined ? (
          <span className="eyebrow">{Math.round(share * 100)}% of {account.currency || "USD"}</span>
        ) : (
          <span className="eyebrow">{account.currency}</span>
        )}
      </span>
    </Link>
  </li>
);

export default AllocationPanel;
