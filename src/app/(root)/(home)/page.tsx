import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import AllocationPanel from "./components/allocationPanel";
import CategoryPanel from "./components/categoryPanel";
import CombinedTotal from "./components/combinedTotal";
import ComingUp from "./components/comingUp";
import YourWeek from "./components/yourWeek";
import ForecastPanel from "@/components/forecastPanel";
import InsightsPanel from "@/components/insightsPanel";
import { findInsights } from "@/lib/insights";
import { weeklyRecap } from "@/lib/recap";
import { findRegular } from "@/lib/recurring";
import { accountForecast } from "@/lib/server/forecast";
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

          <Suspense fallback={null}>
            <CombinedTotal
              totals={accounts.totalsByCurrency}
              base={"INR" in accounts.totalsByCurrency ? "INR" : accounts.primaryCurrency}
            />
          </Suspense>

          <AllocationPanel accounts={accountsData} primaryCurrency={accounts.primaryCurrency} />

          {/* Transactions need the provider's feed, the slowest call. Stream them in
              so the header, balances and allocation appear first. */}
          <Suspense fallback={<ChartPanelSkeleton />}>
            <CategorySection appwriteItemId={appwriteItemId} />
          </Suspense>

          <Suspense fallback={null}>
            <WeekSection appwriteItemId={appwriteItemId} />
          </Suspense>

          <Suspense fallback={null}>
            <ForecastSection appwriteItemId={appwriteItemId} />
          </Suspense>

          <Suspense fallback={null}>
            <InsightsSection appwriteItemId={appwriteItemId} />
          </Suspense>

          <Suspense fallback={null}>
            <ComingUp ownerId={ownerIdOf(loggedIn)} />
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

/** "Will I have enough money?" for the account chosen on Home, short version. Nothing for a new user. */
const ForecastSection = async ({ appwriteItemId }: { appwriteItemId?: string }) => {
  if (!appwriteItemId) return null;
  const result = await accountForecast(appwriteItemId);
  return result ? <ForecastPanel result={result} compact /> : null;
};

/** "What changed" for the account chosen on Home: the top three, with a link to the rest. */
const InsightsSection = async ({ appwriteItemId }: { appwriteItemId?: string }) => {
  if (!appwriteItemId) return null;
  const account = await getAccount({ appwriteItemId });
  if (!account) return null;
  return (
    <InsightsPanel
      result={findInsights(account.transactions)}
      currency={account.data?.currency}
      compact
      href={`/transaction-history?id=${appwriteItemId}#insights`}
    />
  );
};

/** "Your week" for the account chosen on Home. */
const WeekSection = async ({ appwriteItemId }: { appwriteItemId?: string }) => {
  if (!appwriteItemId) return null;
  const account = await getAccount({ appwriteItemId });
  const transactions = (account?.transactions as Transaction[] | undefined) ?? [];
  const recap = weeklyRecap(transactions, findRegular(transactions));
  return recap ? <YourWeek recap={recap} currency={account?.data?.currency} /> : null;
};
