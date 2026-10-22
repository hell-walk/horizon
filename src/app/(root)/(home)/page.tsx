import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import AllocationPanel from "./components/allocationPanel";
import IncomePanel from "./components/incomePanel";
import FeatureTour from "./components/featureTour";
import ProfileCard from "./components/profileCard";
import ReportNumbers from "./components/reportNumbers";
import CategoryPanel from "./components/categoryPanel";
import CombinedTotal from "./components/combinedTotal";
import BeReady from "./components/beReady";
import ChargesTeaser from "./components/chargesTeaser";
import ComingUp from "./components/comingUp";
import YourWeek from "./components/yourWeek";
import ForecastPanel from "@/components/forecastPanel";
import InsightsPanel from "@/components/insightsPanel";
import { findInsights } from "@/lib/insights";
import { weeklyRecap } from "@/lib/recap";
import { findRegular } from "@/lib/recurring";
import { accountForecast } from "@/lib/server/forecast";
import { forecastView } from "@/lib/server/income";
import QuickActions from "./components/quickActions";
import RecentTransaction from "./components/recentTransaction";
import RightSideBar from "./components/rightSideBar";
import { ChartPanelSkeleton, RecentTransactionsSkeleton, RightSideBarSkeleton } from "@/components/skeletons";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { withCoverage } from "@/lib/server/coverage";
import { currentPlan } from "@/lib/server/plan";
import { planLine } from "@/lib/server/planLine";
import { activeAccountId } from "@/lib/server/selectedAccount";
import RememberAccount from "@/components/rememberAccount";
import CardStack from "@/components/cardStack";
import { BarsLoader } from "@/components/loaders";
import PanelPlaceholder from "@/components/panelPlaceholder";
import SpendingStrip from "@/components/spendingStrip";

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

  const accountsData: Account[] = await withCoverage(accounts.data);
  const appwriteItemId = await activeAccountId(accountsData, id);
  const plan = await currentPlan();
  const standing = plan ? await planLine(plan) : "";

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

          {/* What Horizon can do, one feature at a time, under the greeting; each slide opens its page. */}
          <Suspense fallback={null}>
            <FeatureTour />
          </Suspense>

          <QuickActions />

          {/* One row: the balance as it stands, money in each month, and the latest month's three numbers. */}
          <div className="grid gap-6 lg:grid-cols-3">
            <TotalBalanceBox
              accounts={accountsData}
              totalBanks={accounts.totalBanks}
              totalCurrentBalance={accounts.totalCurrentBalance}
              totalsByCurrency={accounts.totalsByCurrency}
              primaryCurrency={accounts.primaryCurrency}
              className="contents"
            />
            <Suspense fallback={<PanelPlaceholder className="min-h-28" />}>
              <IncomePanel ownerId={ownerIdOf(loggedIn)} currency={accounts.primaryCurrency} />
            </Suspense>
            <Suspense fallback={<PanelPlaceholder className="min-h-28" />}>
              <ReportNumbers ownerId={ownerIdOf(loggedIn)} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <CombinedTotal totals={accounts.totalsByCurrency} base={"INR" in accounts.totalsByCurrency ? "INR" : accounts.primaryCurrency} />
          </Suspense>

          {/* Phones and tablets: the profile, then the bank cards, here rather than at the end of the page. */}
          <div className="xl:hidden">
            <ProfileCard user={loggedIn} planLine={standing} />
          </div>
          {accountsData.length > 0 && (
            <div className="xl:hidden">
              <CardStack accounts={accountsData} selected={appwriteItemId} userName={`${loggedIn.firstName} ${loggedIn.lastName}`} mode="url" />
            </div>
          )}

          {/* Money about to leave: EMIs this week, charges coming back. Nothing when there is nothing. */}
          <Suspense fallback={null}>
            <BeReady ownerId={ownerIdOf(loggedIn)} />
          </Suspense>

          {/* Transactions need the provider's feed, the slowest call. Stream them in
              so the header, balances and allocation appear first. */}
          {/* Connected banks: where the money is, and the health score; just above the spending chart. */}
          <AllocationPanel accounts={accountsData} primaryCurrency={accounts.primaryCurrency} ownerId={ownerIdOf(loggedIn)} />

          {/* Keyed by account: when the switch lands, this part is built afresh and arrives with its entrance animations (charts grow, amounts count up). */}
          <div key={`category-${appwriteItemId}`} className="section-arrive flex flex-col empty:hidden">
            <Suspense fallback={<ChartPanelSkeleton />}>
              <CategorySection appwriteItemId={appwriteItemId} />
            </Suspense>
          </div>

          {/* Keyed by account, as above. */}
          <div key={`week-${appwriteItemId}`} className="section-arrive flex flex-col empty:hidden">
            <Suspense fallback={null}>
              <WeekSection appwriteItemId={appwriteItemId} />
            </Suspense>
          </div>

          {/* Keyed by account, as above. */}
          <div key={`forecast-${appwriteItemId}`} className="section-arrive flex flex-col empty:hidden">
            <Suspense fallback={null}>
              <ForecastSection appwriteItemId={appwriteItemId} ownerId={ownerIdOf(loggedIn)} />
            </Suspense>
          </div>

          {/* Keyed by account, as above. */}
          <div key={`insights-${appwriteItemId}`} className="section-arrive flex flex-col empty:hidden">
            <Suspense fallback={null}>
              <InsightsSection appwriteItemId={appwriteItemId} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <ComingUp ownerId={ownerIdOf(loggedIn)} />
          </Suspense>

          <Suspense fallback={null}>
            <ChargesTeaser ownerId={ownerIdOf(loggedIn)} />
          </Suspense>

          {/* Keyed by account, as above. */}
          <div key={`recent-${appwriteItemId}`} className="section-arrive flex flex-col empty:hidden">
            <Suspense fallback={<RecentTransactionsSkeleton />}>
              <RecentTransactionsSection accounts={accountsData} appwriteItemId={appwriteItemId} page={currentPage} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<RightSideBarSkeleton />}>
          <RightSideBar
            user={loggedIn}
            planLine={standing}
            banks={accountsData}
            selected={appwriteItemId}
            spending={
              <div key={`spending-${appwriteItemId}`} className="section-arrive flex flex-col">
                <Suspense fallback={<BarsLoader className="h-[118px]" />}>
                  <SpendingSection appwriteItemId={appwriteItemId} />
                </Suspense>
              </div>
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
      appwriteItemId={appwriteItemId}
    />
  );
}

const breakdownHref = (appwriteItemId?: string) => `/transaction-history?id=${appwriteItemId ?? ""}&from=chart#payees`;

// The short strip under the bank card; same data as the category doughnut.
async function SpendingSection({ appwriteItemId }: { appwriteItemId?: string }) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;
  return <SpendingStrip transactions={account?.transactions} currency={account?.data?.currency} href={breakdownHref(appwriteItemId)} />;
}

async function RecentTransactionsSection({ accounts, appwriteItemId, page }: { accounts: Account[]; appwriteItemId?: string; page: number }) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  return <RecentTransaction accounts={accounts} transactions={account?.transactions} appwriteItemId={appwriteItemId ?? ""} page={page} />;
}

export default Home;

/** "Will I have enough money?" for the account chosen on Home, short version. Nothing for a new user. */
const ForecastSection = async ({ appwriteItemId, ownerId }: { appwriteItemId?: string; ownerId: string }) => {
  if (!appwriteItemId) return null;
  const result = await accountForecast(appwriteItemId, await forecastView(ownerId));
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
