import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BarsLoader } from "@/components/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getAccounts } from "@/lib/server/accounts";
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
const Goals = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="page">
      <HeaderBox eyebrow={t("goals.eyebrow")} title={t("goals.title")} subtext={t("goals.intro")} />
      <div className="max-w-[1400px]">
        <Suspense fallback={<BarsLoader className="h-64" />}>
          <GoalsContent ownerId={ownerIdOf(user)} />
        </Suspense>
      </div>
    </section>
  );
};

async function GoalsContent({ ownerId }: { ownerId: string }) {
  const [goals, leftOver, accounts] = await Promise.all([loadGoals(ownerId), usualLeftOver(ownerId), getAccounts({ userId: ownerId })]);
  const currencies = [...new Set([...((accounts?.data as Account[]) ?? []).map((a) => a.currency ?? "INR"), "INR"])];
  return <GoalsBoard goals={goals} leftOver={leftOver} currencies={currencies} thisMonth={new Date().toISOString().slice(0, 7)} />;
}

export default Goals;
