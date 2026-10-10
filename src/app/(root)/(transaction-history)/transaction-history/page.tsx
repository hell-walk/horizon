import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BankTabItem } from "@/components/BankTabItem";
import { Search, X } from "lucide-react";

import InsightsPanel from "@/components/insightsPanel";
import { Pagination } from "@/components/Pagination";
import MonthlyFlow from "../components/monthlyFlow";
import PayeePanel from "../components/payeePanel";
import TransactionsTable from "@/components/transactionTable";
import HeaderBox from "@/components/ui/headerBox";
import { PROVIDER_LABELS } from "@/constants";
import { getT } from "@/lib/i18n/server";
import { dataLabel } from "@/lib/i18n/labels";
import { findInsights } from "@/lib/insights";
import { groupByPayee, type PayeeSpend } from "@/lib/payees";
import { spendType } from "@/lib/spending";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { activeAccountId } from "@/lib/server/selectedAccount";
import RememberAccount from "@/components/rememberAccount";
import { cn, formatAmount, maskLabel, summarizeTransactions } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("history.metaTitle"), description: t("history.metaDescription") };
}

const ROWS_PER_PAGE = 10;
const FILTERS = [
  { key: "all", label: "history.filterAll" },
  { key: "credit", label: "history.filterIn" },
  { key: "debit", label: "history.filterOut" },
] as const;

const TransactionHistory = async ({ searchParams }: SearchParamProps) => {
  const { id, page, type, from, q } = await searchParams;
  const currentPage = Number(page as string) || 1;
  const filter = type === "credit" || type === "debit" ? type : "all";
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";

  const t = await getT();
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  if (!accounts) return;

  const accountsData: Account[] = accounts.data;
  const appwriteItemId = await activeAccountId(accountsData, id);
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  const all: Transaction[] = account?.transactions ?? [];
  const needle = query.toLowerCase();
  // Search matches the name shown, the bank's text, the category (in English
  // and in the screen's language) and the amount ("450" finds 450.00).
  const matches = (tx: Transaction) => {
    if (!needle) return true;
    const category = spendType(tx);
    const haystack = [tx.shownName, tx.name, category, dataLabel(t, category), String(Math.abs(Number(tx.amount) || 0))];
    return haystack.some((value) => value?.toLowerCase().includes(needle));
  };
  const filtered = all.filter((tx) => {
    if (!matches(tx)) return false;
    if (filter === "all") return true;
    const isDebit = tx.type === "debit" || Number(tx.amount) < 0;
    return filter === "debit" ? isDebit : !isDebit;
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const current = filtered.slice(start, start + ROWS_PER_PAGE);
  const summary = summarizeTransactions(all);
  const currency = account?.data?.currency;
  const providerKey = account && (account.data.provider as string) in PROVIDER_LABELS ? (account.data.provider as string) : "plaid";
  const provider = account ? PROVIDER_LABELS[providerKey] : null;
  const providerText = t(`banks.provider_${providerKey}`);
  const providerName = provider ? (providerText === `banks.provider_${providerKey}` ? provider.name : providerText) : null;

  const filterHref = (key: string) =>
    `/transaction-history/?id=${appwriteItemId}${key === "all" ? "" : `&type=${key}`}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <section className="page">
      <RememberAccount id={appwriteItemId} />
      <HeaderBox
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
        subtext={accountsData.length > 0 ? t("history.subtext", { count: all.length }) : t("history.subtextEmpty")}
      />

      {accountsData.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label={t("history.chooseAccount")}>
          {accountsData.map((a) => (
            <BankTabItem key={a.appwriteItemId} account={a} appwriteItemId={appwriteItemId} />
          ))}
        </div>
      )}

      {account && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="panel flex flex-col gap-1 p-4 max-md:col-span-2">
              <p className="eyebrow">{t("history.account")}</p>
              <p translate="no" className="truncate text-16 font-semibold text-ink">
                {account.data.name}
              </p>
              <p className="eyebrow">
                <span translate="no">{maskLabel(account.data.mask)}</span> · {providerName}
              </p>
              <p translate="no" className="amount mt-2 text-20 font-semibold text-ink">
                {formatAmount(account.data.currentBalance, currency)}
              </p>
            </article>
            <Tile label={t("history.moneyIn")} value={formatAmount(summary.inflow, currency)} entries={t("history.entries", { count: summary.credits })} tone="success" />
            <Tile label={t("history.moneyOut")} value={formatAmount(summary.outflow, currency)} entries={t("history.entries", { count: summary.debits })} tone="danger" />
            <Tile
              label={t("history.net")}
              value={`${summary.net < 0 ? "-" : "+"}${formatAmount(Math.abs(summary.net), currency)}`}
              entries={t("history.entries", { count: all.length })}
              tone={summary.net < 0 ? "danger" : "success"}
            />
          </div>

          <MonthlyFlow transactions={all} currency={currency} />

          <InsightsPanel result={findInsights(all)} currency={currency} />

          <div id="payees" className="scroll-mt-6">
            <PayeePanel groups={forBrowser(groupByPayee(all, 8))} currency={currency} arrive={from === "chart"} />
          </div>

          <section className="panel">
            <header className="panel-head">
              <div className="flex items-center gap-2">
                <span className="eyebrow">{t("history.listTitle")}</span>
                <span className="eyebrow text-ink">{t("history.shown", { count: filtered.length })}</span>
              </div>
              <div className="flex gap-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={filterHref(f.key)}
                    className={cn(
                      "rounded-sm border px-2.5 py-1 font-mono text-[12px] uppercase tracking-wider transition-colors",
                      filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-line bg-card text-ink-muted hover:bg-surface-container"
                    )}
                  >
                    {t(f.label)}
                  </Link>
                ))}
              </div>
            </header>

            <form role="search" action="/transaction-history" method="get" className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
              <input type="hidden" name="id" value={appwriteItemId ?? ""} />
              {filter !== "all" && <input type="hidden" name="type" value={filter} />}
              <div className="field min-w-0 flex-1">
                <label htmlFor="history-search" className="field-label">
                  {t("history.searchLabel")}
                </label>
                <input
                  id="history-search"
                  name="q"
                  type="search"
                  defaultValue={query}
                  maxLength={80}
                  placeholder={t("history.searchPlaceholder")}
                  className="field-input"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn-secondary">
                <Search className="size-4" aria-hidden /> {t("history.searchButton")}
              </button>
              {query && (
                <Link href={filterHref(filter).replace(/&q=[^&]*/, "")} className="btn-ghost">
                  <X className="size-4" aria-hidden /> {t("history.searchClear")}
                </Link>
              )}
            </form>
            {query && (
              <p role="status" className="px-4 pt-3 text-14 text-ink">
                {t("history.searchFound", { count: filtered.length, query })}
              </p>
            )}

            <TransactionsTable transactions={current} accountId={appwriteItemId ?? undefined} />

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

// The payee panel runs in the browser and lists every payment: send only the
// fields it shows, so a big account does not mean a big page.
const forBrowser = (groups: PayeeSpend[]): PayeeSpend[] =>
  groups.map((g) => ({
    ...g,
    transactions: g.transactions.map(
      ({ id, name, amount, date, type, category, currency, shownName, userCategory }) => ({ id, name, amount, date, type, category, currency, shownName, userCategory }) as Transaction
    ),
  }));

const Tile = ({ label, value, entries, tone }: { label: string; value: string; entries: string; tone: "success" | "danger" }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <div className="flex items-center justify-between">
      <p className="eyebrow">{label}</p>
      <span className={cn("dot", tone === "success" ? "bg-success" : "bg-danger")} />
    </div>
    <p translate="no" className={cn("amount truncate text-20 font-semibold", tone === "success" ? "text-success" : "text-danger")}>
      {value}
    </p>
    <p className="eyebrow">{entries}</p>
  </article>
);

export default TransactionHistory;
