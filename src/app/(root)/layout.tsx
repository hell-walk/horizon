import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import ChecksBar from "./components/checksBar";
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
import { planLine } from "@/lib/server/planLine";
import DataUnavailable from "@/components/dataUnavailable";
import TourGuide from "@/components/tour/tourGuide";
import { getT } from "@/lib/i18n/server";
import { TOUR_WORD_KEYS } from "@/lib/tour";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

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
  const [accounts, plan, , t] = await Promise.all([
    getAccounts({ userId: ownerIdOf(loggedIn) }).then((a): Account[] => a?.data ?? []),
    currentPlan(),
    loadExtraTerms(),
    getT(),
  ]);
  // The guided tour's words, translated once here; the guide itself runs in the browser.
  const tourWords = Object.fromEntries(TOUR_WORD_KEYS.map((k) => [k, t(`tour.${k}`)]));
  // Only what the switcher shows leaves the server.
  const switchAccounts = accounts.map(({ appwriteItemId, name, mask, currentBalance, currency }) => ({ appwriteItemId, name, mask, currentBalance, currency }));

  return (
    // Phones scroll the page itself (native, the browser bar hides); tablets and up scroll inside the shell.
    <div className="flex min-h-dvh w-full flex-col md:h-dvh md:overflow-hidden md:overscroll-none">
      <Topbar user={loggedIn} accounts={switchAccounts} activeId={await activeAccountId(accounts)} planLine={plan ? await planLine(plan) : ""} />
      {plan && <PlanBanner plan={plan} />}
      {/* "Is this right?": a line when some payments are unclear, closable for the day. Streamed: never holds the page. */}
      <Suspense fallback={null}>
        <ChecksBar ownerId={ownerIdOf(loggedIn)} person={{ firstName: loggedIn.firstName, lastName: loggedIn.lastName }} />
      </Suspense>
      {/* The page itself is the main landmark; the skip link lands here. */}
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-hidden">
        {children}
      </main>
      <BottomNav />
      <TourGuide words={tourWords} />
      <ScrollCalm />
      <HomeLanguageSync saved={(await loadSession())?.homeLocale ?? null} />
    </div>
  );
}
