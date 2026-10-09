import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BankTabItem } from "@/components/BankTabItem";
import { Pagination } from "@/components/Pagination";
import PayeePanel from "@/components/payeePanel";
import TransactionsTable from "@/components/transactionTable";
import HeaderBox from "@/components/ui/headerBox";
import { PROVIDER_LABELS } from "@/constants";
import { groupByPayee } from "@/lib/payees";
import { getAccount, getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { cn, formatAmount, maskLabel, summarizeTransactions } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Transaction history",
  description: "Browse every transaction on a linked bank account.",
};

const ROWS_PER_PAGE = 10;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "credit", label: "Credits" },
  { key: "debit", label: "Debits" },
] as const;

const TransactionHistory = async ({ searchParams }: SearchParamProps) => {
  const { id, page, type } = await searchParams;
  const currentPage = Number(page as string) || 1;
  const filter = type === "credit" || type === "debit" ? type : "all";

  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  if (!accounts) return;

  const accountsData: Account[] = accounts.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  const all: Transaction[] = account?.transactions ?? [];
  const filtered = all.filter((t) => {
    if (filter === "all") return true;
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    return filter === "debit" ? isDebit : !isDebit;
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const current = filtered.slice(start, start + ROWS_PER_PAGE);
  const summary = summarizeTransactions(all);
  const currency = account?.data?.currency;
  const provider = account ? PROVIDER_LABELS[account.data.provider as string] ?? PROVIDER_LABELS.plaid : null;

  const filterHref = (key: string) => `/transaction-history/?id=${appwriteItemId}${key === "all" ? "" : `&type=${key}`}`;

  return (
    <section className="page">
      <HeaderBox
        eyebrow="Audit // transaction history"
        title="Transaction history"
        subtext={
          accountsData.length > 0
            ? `Complete ledger for each linked account. ${all.length} entries on the selected account.`
            : "Link an account to see its transactions here."
        }
      />

      {accountsData.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {accountsData.map((a) => (
            <BankTabItem key={a.appwriteItemId} account={a} appwriteItemId={appwriteItemId} />
          ))}
        </div>
      )}

      {account && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="panel flex flex-col gap-1 p-4 max-md:col-span-2">
              <p className="eyebrow">Account</p>
              <p className="truncate text-16 font-semibold text-ink">{account.data.name}</p>
              <p className="eyebrow">
                {maskLabel(account.data.mask)} · {provider?.name}
              </p>
              <p className="amount mt-2 text-20 font-semibold text-ink">{formatAmount(account.data.currentBalance, currency)}</p>
            </article>
            <Tile label="Inflow" value={formatAmount(summary.inflow, currency)} count={summary.credits} tone="success" />
            <Tile label="Outflow" value={formatAmount(summary.outflow, currency)} count={summary.debits} tone="danger" />
            <Tile
              label="Net"
              value={`${summary.net < 0 ? "-" : "+"}${formatAmount(Math.abs(summary.net), currency)}`}
              count={all.length}
              tone={summary.net < 0 ? "danger" : "success"}
            />
          </div>

          <div id="payees" className="scroll-mt-6">
            <PayeePanel groups={groupByPayee(all, 8)} currency={currency} />
          </div>

          <section className="panel">
            <header className="panel-head">
              <div className="flex items-center gap-2">
                <span className="eyebrow">Ledger</span>
                <span className="eyebrow text-ink">{"// "}{filtered.length} entries</span>
              </div>
              <div className="flex gap-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={filterHref(f.key)}
                    className={cn(
                      "rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
                      filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-line bg-card text-ink-muted hover:bg-surface-container"
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </header>

            <TransactionsTable transactions={current} />

            {totalPages > 1 && (
              <div className="border-t border-line px-4 py-3">
                <Pagination totalPages={totalPages} page={currentPage} />
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
};

const Tile = ({ label, value, count, tone }: { label: string; value: string; count: number; tone: "success" | "danger" }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <div className="flex items-center justify-between">
      <p className="eyebrow">{label}</p>
      <span className={cn("dot", tone === "success" ? "bg-success" : "bg-danger")} />
    </div>
    <p className={cn("amount truncate text-20 font-semibold", tone === "success" ? "text-success" : "text-danger")}>{value}</p>
    <p className="eyebrow">
      {count} {count === 1 ? "entry" : "entries"}
    </p>
  </article>
);

export default TransactionHistory;
