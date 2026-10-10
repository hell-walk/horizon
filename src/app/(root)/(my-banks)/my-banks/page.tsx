import type { Metadata } from "next";
import { PlugZap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import AccountsTable from "@/components/accountsTable";
import BankShowcase from "../components/bankShowcase";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import type { SpendingByAccount } from "../components/spendingThin";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { ownerIdOf } from "@/lib/server/auth";
import { activeAccountId } from "@/lib/server/selectedAccount";
import { groupBySpendType } from "@/lib/spending";

export const metadata: Metadata = {
  title: "My Banks",
  description: "Every bank account linked to Horizon.",
};

const isThisMonth = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const MyBanks = async () => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  const accountsData: Account[] = accounts?.data ?? [];
  const holder = `${loggedIn.firstName} ${loggedIn.lastName}`;

  // Each account's spending, in the same buckets as the Home doughnut. Not
  // awaited: the cards render now and the thin strip under them streams in.
  const spending: Promise<SpendingByAccount> = Promise.all(
    accountsData.map(async (a) => {
      try {
        const account = await getAccount({ appwriteItemId: a.appwriteItemId });
        const all: Transaction[] = account?.transactions ?? [];
        const monthBuckets = groupBySpendType(all.filter((t) => isThisMonth(t.date)), 5);
        // This month when there is spending in it; statements cover past months, so fall back to all of it.
        const thisMonth = monthBuckets.length > 0;
        const buckets = thisMonth ? monthBuckets : groupBySpendType(all, 5);
        const total = buckets.reduce((s, b) => s + b.amount, 0);
        return [a.appwriteItemId, { buckets, total, currency: a.currency || "USD", period: thisMonth ? "month" : "all" }] as const;
      } catch {
        return [a.appwriteItemId, { buckets: [], total: 0, currency: a.currency || "USD", period: "all" }] as const;
      }
    })
  ).then((entries) => Object.fromEntries(entries));

  return (
    <section className="page">
      <HeaderBox
        eyebrow="Accounts // linked"
        title="My banks"
        subtext="Every account connected through Plaid, Setu or a statement import, with its latest balance."
        actions={
          <Link href="/connect-bank" className="btn-primary">
            <PlugZap className="size-4" /> Connect new bank
          </Link>
        }
      />

      {accounts && (
        <TotalBalanceBox
          accounts={accountsData}
          totalBanks={accounts.totalBanks}
          totalCurrentBalance={accounts.totalCurrentBalance}
          totalsByCurrency={accounts.totalsByCurrency}
          primaryCurrency={accounts.primaryCurrency}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h-section">Cards</h2>
          <span className="eyebrow">{String(accountsData.length).padStart(2, "0")} accounts</span>
        </div>

        {accountsData.length === 0 ? (
          <div className="panel flex-center flex-col gap-3 p-10 text-center">
            <p className="text-16 font-semibold text-ink">No accounts linked yet</p>
            <p className="max-w-md text-14 text-ink-muted">
              Connect a US bank through Plaid, an Indian bank through Setu, or import a statement export.
            </p>
            <Link href="/connect-bank" className="btn-primary mt-2">
              Connect a bank
            </Link>
          </div>
        ) : (
          <BankShowcase accounts={accountsData} holder={holder} spending={spending} initialId={await activeAccountId(accountsData)} />
        )}
      </div>

      <AccountsTable accounts={accountsData} />
    </section>
  );
};

export default MyBanks;
