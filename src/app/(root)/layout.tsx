import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import PlanBanner from "./components/planBanner";
import ScrollCalm from "./components/scrollCalm";
import Topbar from "./components/topbar";
import { getLoggedInUser, loadSession, ownerIdOf } from "@/lib/server/auth";
import { DataUnavailableError, getBanks } from "@/lib/server/banks";
import { currentPlan } from "@/lib/server/plan";
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

  // Cached for 30s, so this costs nothing on top of the page's own call. The
  // team's added lender and subscription names (cached minutes) are loaded here
  // so every page's sorting sees them.
  const [banks, plan] = await Promise.all([getBanks({ userId: ownerIdOf(loggedIn) }).then((b) => b ?? []), currentPlan(), loadExtraTerms()]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <Topbar user={loggedIn} bankCount={banks.length} planLine={plan ? await planLine(plan) : ""} />
      {plan && <PlanBanner plan={plan} />}
      {/* The page itself is the main landmark; the skip link lands here. */}
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {children}
      </main>
      <BottomNav />
      <ScrollCalm />
    </div>
  );
}
