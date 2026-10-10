import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import AllocationPanel from "./components/allocationPanel";
import CategoryPanel from "./components/categoryPanel";
import SpendingStrip from "./components/spendingStrip";
import QuickActions from "./components/quickActions";
import RecentTransaction from "./components/recentTransaction";
import RightSideBar from "./components/rightSideBar";
import { ChartPanelSkeleton, RecentTransactionsSkeleton, RightSideBarSkeleton } from "@/components/skeletons";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { activeAccountId } from "@/lib/server/selectedAccount";
import RememberAccount from "@/components/rememberAccount";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("home.metaTitle"), description: t("home.metaDescription") };
}

/** Message key for the greeting at this hour. */
const greetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
};

const Home = async ({ searchParams }: SearchParamProps) => {
  const { id, page } = await searchParams;
  const currentPage = Number(page as string) || 1;

  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const t = await getT();
  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  if (!accounts) return;

  const accountsData: Account[] = accounts.data;
  const appwriteItemId = await activeAccountId(accountsData, id);

  return (
    <section className="page">
      <RememberAccount id={appwriteItemId} />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <HeaderBox
            type="greeting"
            eyebrow={t("home.eyebrow")}
            title={t(greetingKey())}
            user={loggedIn.firstName || loggedIn.name || t("home.greetingFallbackName")}
            subtext={accountsData.length > 0 ? t("home.subtextAccounts", { count: accountsData.length }) : t("home.subtextEmpty")}
          />

          <QuickActions />

          <TotalBalanceBox
            accounts={accountsData}
            totalBanks={accounts.totalBanks}
            totalCurrentBalance={accounts.totalCurrentBalance}
            totalsByCurrency={accounts.totalsByCurrency}
            primaryCurrency={accounts.primaryCurrency}
          />

          <AllocationPanel accounts={accountsData} primaryCurrency={accounts.primaryCurrency} />

          {/* Transactions need the provider's feed, the slowest call. Stream them in
              so the header, balances and allocation appear first. */}
          <Suspense fallback={<ChartPanelSkeleton />}>
            <CategorySection appwriteItemId={appwriteItemId} />
          </Suspense>

          <Suspense fallback={<RecentTransactionsSkeleton />}>
            <RecentTransactionsSection accounts={accountsData} appwriteItemId={appwriteItemId} page={currentPage} />
          </Suspense>
        </div>

        <Suspense fallback={<RightSideBarSkeleton />}>
          <RightSideBar
            user={loggedIn}
            banks={accountsData}
            selected={appwriteItemId}
            spending={
              <Suspense fallback={<div className="h-[118px] animate-pulse rounded-lg bg-surface-container" />}>
                <SpendingSection appwriteItemId={appwriteItemId} />
              </Suspense>
            }
          />
        </Suspense>
      </div>
    </section>
  );
};

// All sections call getAccount; it is deduped per request, so the provider is hit once.
async function CategorySection({ appwriteItemId }: { appwriteItemId?: string }) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;
  return (
    <CategoryPanel
      transactions={account?.transactions}
      currency={account?.data?.currency}
      accountName={account?.data?.name}
      href={breakdownHref(appwriteItemId)}
    />
  );
}

const breakdownHref = (appwriteItemId?: string) => `/transaction-history?id=${appwriteItemId ?? ""}&from=chart#payees`;

// The short strip under the bank card; same data as the category doughnut.
async function SpendingSection({ appwriteItemId }: { appwriteItemId?: string }) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;
  return <SpendingStrip transactions={account?.transactions} currency={account?.data?.currency} href={breakdownHref(appwriteItemId)} />;
}

async function RecentTransactionsSection({
  accounts,
  appwriteItemId,
  page,
}: {
  accounts: Account[];
  appwriteItemId?: string;
  page: number;
}) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  return (
    <RecentTransaction accounts={accounts} transactions={account?.transactions} appwriteItemId={appwriteItemId ?? ""} page={page} />
  );
}

export default Home;
