import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import RightSideBar from "@/components/rightSideBar";
import RecentTransaction from "@/components/recentTransaction";
import { RecentTransactionsSkeleton, RightSideBarSkeleton } from "@/components/skeletons";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { getAccount, getAccounts } from "@/lib/actions/bank.actions";

export const metadata: Metadata = {
  title: "Home",
  description: "Your balances and recent transactions across every linked bank.",
};

const Home = async ({ searchParams }: SearchParamProps) => {
  const { id, page } = await searchParams;
  const currentPage = Number(page as string) || 1;

  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  if (!accounts) return;

  const accountsData = accounts?.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.name || "Guest"}
            subtext="Access and manage your account transactions efficiently"
          />
          <TotalBalanceBox
            accounts={accountsData}
            totalBanks={accounts?.totalBanks}
            totalCurrentBalance={accounts?.totalCurrentBalance}
            totalsByCurrency={accounts?.totalsByCurrency}
            primaryCurrency={accounts?.primaryCurrency}
          />
        </header>

        {/* Transactions need Plaid's sync feed, the slowest call. Stream them in
            so the greeting and balance appear first. */}
        <Suspense fallback={<RecentTransactionsSkeleton />}>
          <RecentTransactionsSection
            accounts={accountsData}
            appwriteItemId={appwriteItemId}
            page={currentPage}
          />
        </Suspense>
      </div>

      <Suspense fallback={<RightSideBarSkeleton />}>
        <RightSideBarSection
          user={loggedIn}
          banks={accountsData?.slice(0, 2)}
          appwriteItemId={appwriteItemId}
        />
      </Suspense>
    </section>
  );
};

// Both sections call getAccount; it is deduped per request, so Plaid is hit once.
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
    <RecentTransaction
      accounts={accounts}
      transactions={account?.transactions}
      appwriteItemId={appwriteItemId ?? ""}
      page={page}
    />
  );
}

async function RightSideBarSection({
  user,
  banks,
  appwriteItemId,
}: {
  user: User;
  banks: RightSidebarProps["banks"];
  appwriteItemId?: string;
}) {
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  return <RightSideBar user={user} transactions={account?.transactions} banks={banks} />;
}

export default Home;
