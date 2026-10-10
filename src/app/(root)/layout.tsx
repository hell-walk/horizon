import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import Topbar from "./components/topbar";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { getBanks } from "@/lib/server/banks";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  // Cached for 30s, so this costs nothing on top of the page's own call.
  const banks: Bank[] = (await getBanks({ userId: ownerIdOf(loggedIn) })) ?? [];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <Topbar user={loggedIn} bankCount={banks.length} />
      {/* The page itself is the main landmark; the skip link lands here. */}
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
