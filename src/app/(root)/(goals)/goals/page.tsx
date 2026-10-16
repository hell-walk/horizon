import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import CardStack from "@/components/cardStack";
import { BarsLoader } from "@/components/loaders";
import SpendingStrip from "@/components/spendingStrip";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { activeAccountId } from "@/lib/server/selectedAccount";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { loadGoals } from "@/lib/server/goals";
import { usualLeftOver } from "@/lib/server/leftover";

import GoalsBoard from "../components/goalsBoard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("goals.metaTitle"), description: t("goals.metaDescription") };
}

// Savings goals: what the user is saving for, when they will get there, and "what if".
// The heading draws at once; the board (which reads every account for the
// "usually left over" figure) streams in behind the bars.
const Goals = async ({ searchParams }: { searchParams: Promise<{ id?: string }> }) => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const { id } = await searchParams;

  return (
    <section className="page">
      <HeaderBox eyebrow={t("goals.eyebrow")} title={t("goals.title")} subtext={t("goals.intro")} />
      <div className="max-w-[1400px]">
        <Suspense fallback={<BarsLoader className="h-64" />}>
          <GoalsContent user={user} id={typeof id === "string" ? id : undefined} />
        </Suspense>
      </div>
    </section>
  );
};

async function GoalsContent({ user, id }: { user: User; id?: string }) {
  const ownerId = ownerIdOf(user);
  const [goals, leftOver, accounts] = await Promise.all([loadGoals(ownerId), usualLeftOver(ownerId), getAccounts({ userId: ownerId })]);
  const accountsData = (accounts?.data as Account[]) ?? [];
  const currencies = [...new Set([...accountsData.map((a) => a.currency ?? "INR"), "INR"])];
  // The bank cards pick which account's spending the side column shows (?id=, as on Home).
  const appwriteItemId = await activeAccountId(accountsData, id);
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;
  const spending =
    accountsData.length > 0 ? (
      <div className="flex flex-col gap-3">
        <CardStack accounts={accountsData} selected={appwriteItemId} userName={`${user.firstName} ${user.lastName}`} mode="url" />
        <SpendingStrip transactions={account?.transactions} currency={account?.data?.currency} href={`/transaction-history?id=${appwriteItemId ?? ""}&from=chart#payees`} />
      </div>
    ) : null;
  return <GoalsBoard goals={goals} leftOver={leftOver} currencies={currencies} thisMonth={new Date().toISOString().slice(0, 7)} spending={spending} />;
}

export default Goals;
