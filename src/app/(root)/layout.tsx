import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { getBanks, getLoggedInUser } from "@/lib/actions/user.action";

// Every page in this group depends on the session cookie, so never prerender them.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  // Cached for 30s, so this costs nothing on top of the page's own call.
  const banks: Bank[] = (await getBanks({ userId: loggedIn.$id })) ?? [];
  const providerCounts = banks.reduce<Record<string, number>>((counts, bank) => {
    const provider = bank.provider ?? "plaid";
    counts[provider] = (counts[provider] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className="flex h-screen w-full overflow-hidden">
      <Sidebar user={loggedIn} providerCounts={providerCounts} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar user={loggedIn} bankCount={banks.length} />
        {children}
      </div>
    </main>
  );
}
