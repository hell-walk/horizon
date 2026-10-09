import type { Metadata } from "next";
import { PlugZap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import AccountsTable from "@/components/accountsTable";
import BankShowcase from "@/components/bankShowcase";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import { getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.action";

export const metadata: Metadata = {
  title: "My Banks",
  description: "Every bank account linked to Horizon.",
};

const MyBanks = async () => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  const accountsData: Account[] = accounts?.data ?? [];
  const holder = `${loggedIn.firstName} ${loggedIn.lastName}`;

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
          <BankShowcase accounts={accountsData} holder={holder} />
        )}
      </div>

      <AccountsTable accounts={accountsData} />
    </section>
  );
};

export default MyBanks;
