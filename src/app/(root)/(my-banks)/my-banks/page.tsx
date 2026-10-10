import type { Metadata } from "next";
import { PlugZap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import AccountsTable from "@/components/accountsTable";
import BankShowcase from "../components/bankShowcase";
import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import type { SpendingByAccount } from "../components/spendingThin";
import { getT } from "@/lib/i18n/server";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { activeAccountId } from "@/lib/server/selectedAccount";
import { groupBySpendType } from "@/lib/spending";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("banks.metaTitle"), description: t("banks.metaDescription") };
}

const isThisMonth = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const MyBanks = async () => {
  const t = await getT();
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
        const monthBuckets = groupBySpendType(all.filter((tx) => isThisMonth(tx.date)), 5);
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
        eyebrow={t("banks.eyebrow")}
        title={t("banks.title")}
        subtext={t("banks.subtext")}
        actions={
          <Link href="/connect-bank" className="btn-primary">
            <PlugZap className="size-4" /> {t("banks.connectNew")}
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
          <h2 className="h-section">{t("banks.cards")}</h2>
          <span className="eyebrow">{t("banks.accountsCount", { count: accountsData.length })}</span>
        </div>

        {accountsData.length === 0 ? (
          <div className="panel flex-center flex-col gap-3 p-10 text-center">
            <p className="text-16 font-semibold text-ink">{t("banks.emptyTitle")}</p>
            <p className="max-w-md text-14 text-ink-muted">
              {t("banks.emptyBody")}
            </p>
            <Link href="/connect-bank" className="btn-primary mt-2">
              {t("banks.connectBank")}
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
