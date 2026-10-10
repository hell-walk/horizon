import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
const Goals = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  const [goals, leftOver, accounts] = await Promise.all([loadGoals(ownerIdOf(user)), usualLeftOver(ownerIdOf(user)), getAccounts({ userId: ownerIdOf(user) })]);
  const currencies = [...new Set([...((accounts?.data as Account[]) ?? []).map((a) => a.currency ?? "INR"), "INR"])];

  return (
    <section className="page">
      <HeaderBox eyebrow={t("goals.eyebrow")} title={t("goals.title")} subtext={t("goals.intro")} />
      <div className="max-w-[1400px]">
        <GoalsBoard goals={goals} leftOver={leftOver} currencies={currencies} thisMonth={new Date().toISOString().slice(0, 7)} />
      </div>
    </section>
  );
};

export default Goals;
