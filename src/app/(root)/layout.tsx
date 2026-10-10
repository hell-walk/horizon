import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BottomNav from "./components/bottomNav";
import Topbar from "./components/topbar";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { ownerIdOf } from "@/lib/server/auth";
import { getBanks } from "@/lib/server/banks";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  // Cached for 30s, so this costs nothing on top of the page's own call.
  const banks: Bank[] = (await getBanks({ userId: ownerIdOf(loggedIn) })) ?? [];

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden">
      <Topbar user={loggedIn} bankCount={banks.length} />
      {children}
      <BottomNav />
    </main>
  );
}
