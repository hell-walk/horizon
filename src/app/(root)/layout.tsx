import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import HomeLanguageSync from "./components/homeLanguageSync";
import PlanBanner from "./components/planBanner";
import ScrollCalm from "./components/scrollCalm";
import Topbar from "./components/topbar";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, loadSession, ownerIdOf } from "@/lib/server/auth";
import { DataUnavailableError } from "@/lib/server/banks";
import { currentPlan } from "@/lib/server/plan";
import { activeAccountId } from "@/lib/server/selectedAccount";
import { loadExtraTerms } from "@/lib/server/terms";
import { getLocale, getT } from "@/lib/i18n/server";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { daysLeft } from "@/lib/plans";
import DataUnavailable from "@/components/dataUnavailable";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

// "Free trial: 5 days left", "Subscribed until 13 November 2026", "Free week ended": under the name, everywhere.
async function planLine(plan: NonNullable<Awaited<ReturnType<typeof currentPlan>>>) {
  const t = await getT();
  if (plan.kind === "trial") return t("plan.lineTrial", { count: daysLeft(plan.endsAt) });
  if (plan.kind === "ended") return t("plan.lineEnded");
  const date = new Date(plan.until).toLocaleDateString(LOCALE_TAGS[await getLocale()], { day: "numeric", month: "long", year: "numeric" });
  return t(plan.renews ? "plan.lineRenews" : "plan.lineUntil", { date });
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  let loggedIn: User | null;
  try {
    loggedIn = await getLoggedInUser();
  } catch (error) {
    // The records store is not answering: say so, rather than treat everyone
    // as new and send them to the setup page.
    if (error instanceof DataUnavailableError) return <DataUnavailable />;
    throw error;
  }
  // Signed in without a profile (first time with Google): finish setting up first.
  if (!loggedIn) redirect((await loadSession()) ? "/welcome" : "/sign-in");

  // The bank rows are cached for 30s, so this costs little on top of the page's
  // own call. The accounts feed the switcher in the profile panel. The team's
  // added lender and subscription names (cached minutes) are loaded here so
  // every page's sorting sees them.
  const [accounts, plan] = await Promise.all([
    getAccounts({ userId: ownerIdOf(loggedIn) }).then((a): Account[] => a?.data ?? []),
    currentPlan(),
    loadExtraTerms(),
  ]);
  // Only what the switcher shows leaves the server.
  const switchAccounts = accounts.map(({ appwriteItemId, name, mask, currentBalance, currency }) => ({ appwriteItemId, name, mask, currentBalance, currency }));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden overscroll-none">
      <Topbar user={loggedIn} accounts={switchAccounts} activeId={await activeAccountId(accounts)} planLine={plan ? await planLine(plan) : ""} />
      {plan && <PlanBanner plan={plan} />}
      {/* The page itself is the main landmark; the skip link lands here. */}
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-hidden">
        {children}
      </main>
      <BottomNav />
      <ScrollCalm />
      <HomeLanguageSync saved={(await loadSession())?.homeLocale ?? null} />
    </div>
  );
}
