import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import AppShell from "@/components/appShell";
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
    <AppShell user={loggedIn} bankCount={banks.length} providerCounts={providerCounts}>
      {children}
    </AppShell>
  );
}
