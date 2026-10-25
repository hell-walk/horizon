import Link from "next/link";
import { Suspense } from "react";

import { CHART_COLOR_CLASSES, PROVIDER_LABELS } from "@/constants";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

import { DoughnutChart } from "./doughnutChartLazy";
import HealthRing from "./healthRing";

// Solid doughnut of balances in the primary currency, every account listed beside it, and
// on the right the health score as a ring (it opens the report).
const AllocationPanel = async ({ accounts, primaryCurrency, ownerId }: { accounts: Account[]; primaryCurrency: string; ownerId: string }) => {
  const t = await getT();
  const charted = accounts.filter((a) => (a.currency || "USD") === primaryCurrency && a.currentBalance > 0);
  const chartTotal = charted.reduce((sum, a) => sum + a.currentBalance, 0);
  const others = accounts.filter((a) => (a.currency || "USD") !== primaryCurrency);
  const centre = (
    <div className="pointer-events-none absolute inset-0 flex-center flex-col">
      <span className="eyebrow">{t("home.total")}</span>
      <span className="font-display text-24 font-semibold text-ink">{accounts.length}</span>
      <span className="eyebrow">{t("home.accountWord", { count: accounts.length })}</span>
    </div>
  );

  return (
    <section className="panel" data-tour="banks">
      <header className="panel-head">
        <span className="eyebrow">{t("home.allocationTitle")}</span>
        <span className="eyebrow">{t("home.accountCount", { count: accounts.length })}</span>
      </header>

      <div className="panel-body grid gap-6 md:grid-cols-[200px_1fr] md:items-center lg:grid-cols-[200px_1fr_auto]">
        <div className="relative mx-auto size-[180px] md:size-[200px]">
          {charted.length > 0 ? (
            <DoughnutChart accounts={charted} centre={centre} />
          ) : (
            <>
              <div className="size-full rounded-full border-14 border-surface-container" />
              {centre}
            </>
          )}
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {charted.map((account, i) => (
            <AllocationRow
              key={account.appwriteItemId}
              t={t}
              account={account}
              share={chartTotal ? account.currentBalance / chartTotal : 0}
              colorClass={CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length]}
            />
          ))}
          {others.map((account) => (
            <AllocationRow key={account.appwriteItemId} t={t} account={account} colorClass="bg-line" />
          ))}
          {accounts.length === 0 && (
            <li className="py-3 text-14 text-ink-muted">
              {t("home.allocationEmpty")}{" "}
              <Link href="/connect-bank" className="font-semibold text-ink underline underline-offset-4">
                {t("nav.connect")}
              </Link>
            </li>
          )}
        </ul>

        {/* Streamed: the accounts show at once, the score follows. */}
        {accounts.length > 0 && (
          <div className="flex justify-center border-t border-line pt-4 md:col-span-2 lg:col-span-1 lg:min-w-48 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Suspense fallback={<div className="h-44 w-32 animate-pulse rounded-md bg-surface-low" />}>
              <HealthRing ownerId={ownerId} />
            </Suspense>
          </div>
        )}
      </div>
    </section>
  );
};

const AllocationRow = ({ t, account, share, colorClass }: { t: Translate; account: Account; share?: number; colorClass: string }) => (
  <li>
    <Link
      href={`/transaction-history/?id=${account.appwriteItemId}`}
      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-low"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("size-2.5 shrink-0 rounded-sm", colorClass)} />
        <span className="flex min-w-0 flex-col">
          <span translate="no" className="truncate text-14 font-semibold text-ink">
            {account.name}
          </span>
          <span className="eyebrow">
            <span translate="no">{maskLabel(account.mask)}</span> · {t((PROVIDER_LABELS[account.provider] ?? PROVIDER_LABELS.plaid).nameKey)}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span translate="no" className="amount text-14 font-semibold text-ink">
          {formatAmount(account.currentBalance, account.currency)}
        </span>
        {share !== undefined ? (
          <span className="eyebrow">{t("home.shareOf", { percent: Math.round(share * 100), currency: account.currency || "USD" })}</span>
        ) : (
          <span translate="no" className="eyebrow">
            {account.currency}
          </span>
        )}
      </span>
    </Link>
  </li>
);

export default AllocationPanel;
