import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import TransactionTable from "@/components/transactionTable";
import { getT } from "@/lib/i18n/server";

import { BankTabItem } from "@/components/BankTabItem";
import { Pagination } from "@/components/Pagination";

const ROWS_PER_PAGE = 10;

// Latest activity for the selected account, with a chip per account to switch.
const RecentTransaction = async ({ accounts, transactions = [], appwriteItemId, page = 1 }: RecentTransactionsProps) => {
  const t = await getT();
  const totalPages = Math.ceil(transactions.length / ROWS_PER_PAGE);
  const start = (page - 1) * ROWS_PER_PAGE;
  const current = transactions.slice(start, start + ROWS_PER_PAGE);

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{t("home.recentTitle")}</span>
        </div>
        <Link href={`/transaction-history/?id=${appwriteItemId}`} className="btn-ghost btn-sm -mr-2">
          {t("home.viewAll")} <ArrowUpRight className="size-3.5" />
        </Link>
      </header>

      {accounts.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line px-4 py-3" role="group" aria-label={t("home.chooseAccount")}>
          {accounts.map((account: Account) => (
            <BankTabItem key={account.appwriteItemId} account={account} appwriteItemId={appwriteItemId} />
          ))}
        </div>
      )}

      <TransactionTable transactions={current} />

      {totalPages > 1 && (
        <div className="border-t border-line px-4 py-3">
          <Pagination totalPages={totalPages} page={page} />
        </div>
      )}
    </section>
  );
};

export default RecentTransaction;
