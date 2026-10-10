import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatAmount, formatDateTime, getTransactionStatus, removeSpecialCharacters } from "@/lib/utils";

const CategoryBadge = ({ category }: CategoryBadgeProps) => <span className="chip">{category}</span>;

const StatusBadge = ({ status }: { status: string }) => {
  const settled = status === "Success";
  return (
    <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-ink-muted">
      <span className={cn("dot", settled ? "bg-lime" : "bg-warn")} />
      {settled ? "Settled" : "Processing"}
    </span>
  );
};

type Row = {
  t: Transaction;
  isDebit: boolean;
  amount: string;
  status: string;
  date: string;
  time?: string;
};

const toRow = (t: Transaction): Row => {
  const when = formatDateTime(new Date(t.date));
  return {
    t,
    isDebit: t.type === "debit" || Number(t.amount) < 0,
    amount: formatAmount(Math.abs(Number(t.amount) || 0), t.currency),
    status: getTransactionStatus(new Date(t.date)),
    date: when.dateOnly,
    time: /T\d/.test(t.date) ? when.timeOnly : undefined,
  };
};

// Transactions as a table on tablet and up, and as a list of rows on phones
// (the mobile Stitch design): icon, name and meta on the left, amount and
// status on the right.
const TransactionsTable = ({ transactions }: TransactionTableProps) => {
  if (transactions.length === 0) {
    return (
      <div className="flex-center h-32 rounded-md border border-dashed border-line text-14 text-ink-muted">
        No transactions for this account yet.
      </div>
    );
  }

  const rows = transactions.map(toRow);

  return (
    <>
      <ul className="divide-y divide-line md:hidden">
        {rows.map(({ t, isDebit, amount, status, date }) => (
          <li key={t.id} className={cn("flex items-center gap-3 px-4 py-3", isDebit ? "row-debit" : "row-credit")}>
            <span className={cn("flex-center size-9 shrink-0 rounded-sm", isDebit ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
              {isDebit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-14 font-semibold text-ink">{removeSpecialCharacters(t.name)}</span>
              <span className="eyebrow truncate">
                {t.category || "Other"} · {date}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className={cn("amount text-14 font-semibold", isDebit ? "text-danger" : "text-success")}>
                {isDebit ? "-" : "+"}
                {amount}
              </span>
              <span className="eyebrow">{status === "Success" ? "Settled" : "Processing"}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="eyebrow h-9 px-3">Transaction</TableHead>
              <TableHead className="eyebrow h-9 px-3">Category</TableHead>
              <TableHead className="eyebrow h-9 px-3">Date</TableHead>
              <TableHead className="eyebrow h-9 px-3 max-lg:hidden">Status</TableHead>
              <TableHead className="eyebrow h-9 px-3 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ t, isDebit, amount, status, date, time }) => (
              <TableRow key={t.id} className={cn("border-line", isDebit ? "row-debit" : "row-credit")}>
                <TableCell className="max-w-[260px] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("dot", isDebit ? "bg-danger" : "bg-success")} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-14 font-semibold text-ink">{removeSpecialCharacters(t.name)}</span>
                      <span className="eyebrow truncate">{t.paymentChannel || "other"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <CategoryBadge category={t.category || "Other"} />
                </TableCell>
                <TableCell className="min-w-28 px-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-12 text-ink">{date}</span>
                    {time && <span className="eyebrow">{time}</span>}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 max-lg:hidden">
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell className={cn("amount px-3 py-3 text-right text-14 font-semibold", isDebit ? "text-danger" : "text-success")}>
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
