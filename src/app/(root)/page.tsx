import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import AllocationPanel from "@/components/allocationPanel";
import CategoryPanel from "@/components/categoryPanel";
import QuickActions from "@/components/quickActions";
import RecentTransaction from "@/components/recentTransaction";
import RightSideBar from "@/components/rightSideBar";
import { ChartPanelSkeleton, RecentTransactionsSkeleton, RightSideBarSkeleton } from "@/components/skeletons";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import { getAccount, getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.action";

export const metadata: Metadata = {
  title: "Home",
  description: "Your balances and recent transactions across every linked bank.",
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const Home = async ({ searchParams }: SearchParamProps) => {
  const { id, page } = await searchParams;
  const currentPage = Number(page as string) || 1;

  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  if (!accounts) return;

  const accountsData: Account[] = accounts.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

  return (
    <section className="page">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <HeaderBox
            type="greeting"
            eyebrow="Overview // portfolio"
            title={greeting()}
            user={loggedIn.firstName || loggedIn.name || "there"}
            subtext={
              accountsData.length > 0
                ? `Balances and activity across ${accountsData.length} linked ${accountsData.length === 1 ? "account" : "accounts"}.`
                : "Connect a bank or import a statement to get started."
            }
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
          <RightSideBar user={loggedIn} banks={accountsData} selected={appwriteItemId} />
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
    />
  );
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
