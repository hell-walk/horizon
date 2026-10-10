import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import PlanBanner from "./components/planBanner";
import ScrollCalm from "./components/scrollCalm";
import Topbar from "./components/topbar";
import { getLoggedInUser, loadSession, ownerIdOf } from "@/lib/server/auth";
import { getBanks } from "@/lib/server/banks";
import { currentPlan } from "@/lib/server/plan";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const loggedIn = await getLoggedInUser();
  // Signed in without a profile (first time with Google): finish setting up first.
  if (!loggedIn) redirect((await loadSession()) ? "/welcome" : "/sign-in");

  // Cached for 30s, so this costs nothing on top of the page's own call.
  const [banks, plan] = await Promise.all([getBanks({ userId: ownerIdOf(loggedIn) }).then((b) => b ?? []), currentPlan()]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <Topbar user={loggedIn} bankCount={banks.length} />
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
