import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { cn, formatAmount, formatDateTime, getTransactionStatus, removeSpecialCharacters } from "@/lib/utils";
import { dataLabel } from "@/lib/i18n/labels";

// A translated label for a value that comes from data, or the value itself when there is no key for it.
const labelFor = (t: Translate, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// Categories share the spending buckets' words ("Food", "Travel", "Other"); others stay as the bank sent them.
const categoryLabel = (t: Translate, category?: string) => dataLabel(t, category || "Other");

const CategoryBadge = ({ category }: CategoryBadgeProps) => <span className="chip">{category}</span>;

const StatusBadge = ({ status, t }: { status: string; t: Translate }) => {
  const settled = status === "Success";
  return (
    <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-ink-muted">
      <span className={cn("dot", settled ? "bg-lime" : "bg-warn")} />
      {settled ? t("history.statusDone") : t("history.statusPending")}
    </span>
  );
};

type Row = {
  tx: Transaction;
  isDebit: boolean;
  amount: string;
  status: string;
  date: string;
  time?: string;
};

const toRow = (tx: Transaction): Row => {
  const when = formatDateTime(new Date(tx.date));
  return {
    tx,
    isDebit: tx.type === "debit" || Number(tx.amount) < 0,
    amount: formatAmount(Math.abs(Number(tx.amount) || 0), tx.currency),
    status: getTransactionStatus(new Date(tx.date)),
    date: when.dateOnly,
    time: /T\d/.test(tx.date) ? when.timeOnly : undefined,
  };
};

// Transactions as a table on tablet and up, and as a list of rows on phones
// (the mobile Stitch design): icon, name and meta on the left, amount and
// status on the right. Rendered only by server components, so it reads the language itself.
const TransactionsTable = async ({ transactions }: TransactionTableProps) => {
  const t = await getT();
  if (transactions.length === 0) {
    return <div className="flex-center h-32 rounded-md border border-dashed border-line text-14 text-ink-muted">{t("history.noEntries")}</div>;
  }

  const rows = transactions.map(toRow);

  return (
    <>
      <ul className="divide-y divide-line md:hidden">
        {rows.map(({ tx, isDebit, amount, status, date }) => (
          <li key={tx.id} className={cn("flex items-center gap-3 px-4 py-3", isDebit ? "row-debit" : "row-credit")}>
            <span className={cn("flex-center size-9 shrink-0 rounded-sm", isDebit ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
              {isDebit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
              <span className="sr-only">{isDebit ? t("history.moneyOut") : t("history.moneyIn")}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span translate="no" className="truncate text-14 font-semibold text-ink">
                {removeSpecialCharacters(tx.name)}
              </span>
              <span className="eyebrow truncate">
                {categoryLabel(t, tx.category)} · <span translate="no">{date}</span>
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span translate="no" className={cn("amount text-14 font-semibold", isDebit ? "text-danger" : "text-success")}>
                {isDebit ? "-" : "+"}
                {amount}
              </span>
              <span className="eyebrow">{status === "Success" ? t("history.statusDone") : t("history.statusPending")}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="eyebrow h-9 px-3">{t("history.colDetails")}</TableHead>
              <TableHead className="eyebrow h-9 px-3">{t("history.colCategory")}</TableHead>
              <TableHead className="eyebrow h-9 px-3">{t("history.colDate")}</TableHead>
              <TableHead className="eyebrow h-9 px-3 max-lg:hidden">{t("history.colStatus")}</TableHead>
              <TableHead className="eyebrow h-9 px-3 text-right">{t("history.colAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ tx, isDebit, amount, status, date, time }) => (
              <TableRow key={tx.id} className={cn("border-line", isDebit ? "row-debit" : "row-credit")}>
                <TableCell className="max-w-[260px] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("dot", isDebit ? "bg-danger" : "bg-success")} />
                    <span className="sr-only">{isDebit ? t("history.moneyOut") : t("history.moneyIn")}</span>
                    <div className="flex min-w-0 flex-col">
                      <span translate="no" className="truncate text-14 font-semibold text-ink">
                        {removeSpecialCharacters(tx.name)}
                      </span>
                      <span className="eyebrow truncate">{labelFor(t, `history.channel_${slug(tx.paymentChannel || "other")}`, tx.paymentChannel || "other")}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <CategoryBadge category={categoryLabel(t, tx.category)} />
                </TableCell>
                <TableCell className="min-w-28 px-3 py-3">
                  <div translate="no" className="flex flex-col">
                    <span className="font-mono text-12 text-ink">{date}</span>
                    {time && <span className="eyebrow">{time}</span>}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 max-lg:hidden">
                  <StatusBadge status={status} t={t} />
                </TableCell>
                <TableCell translate="no" className={cn("amount px-3 py-3 text-right text-14 font-semibold", isDebit ? "text-danger" : "text-success")}>
                  {isDebit ? "-" : "+"}
                  {amount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

export default TransactionsTable;
