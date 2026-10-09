import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatAmount, formatDateTime, getTransactionStatus, removeSpecialCharacters } from "@/lib/utils";

const CategoryBadge = ({ category }: CategoryBadgeProps) => <span className="chip">{category}</span>;

const StatusBadge = ({ status }: { status: string }) => {
  const settled = status === "Success";
  return (
    <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
      <span className={cn("dot", settled ? "bg-lime" : "bg-warn")} />
      {settled ? "Settled" : "Processing"}
    </span>
  );
};

const TransactionsTable = ({ transactions }: TransactionTableProps) => {
  if (transactions.length === 0) {
    return (
      <div className="flex-center h-32 rounded-md border border-dashed border-line text-14 text-ink-muted">
        No transactions for this account yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="eyebrow h-9 px-3">Transaction</TableHead>
          <TableHead className="eyebrow h-9 px-3 max-md:hidden">Category</TableHead>
          <TableHead className="eyebrow h-9 px-3">Date</TableHead>
          <TableHead className="eyebrow h-9 px-3 max-lg:hidden">Status</TableHead>
          <TableHead className="eyebrow h-9 px-3 text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t: Transaction) => {
          const status = getTransactionStatus(new Date(t.date));
          const isDebit = t.type === "debit" || Number(t.amount) < 0;
          const amount = formatAmount(Math.abs(Number(t.amount) || 0), t.currency);
          const when = formatDateTime(new Date(t.date));
          const hasTime = /T\d/.test(t.date);

          return (
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

              <TableCell className="px-3 py-3 max-md:hidden">
                <CategoryBadge category={t.category || "Other"} />
              </TableCell>

              <TableCell className="min-w-28 px-3 py-3">
                <div className="flex flex-col">
                  <span className="font-mono text-12 text-ink">{when.dateOnly}</span>
                  {hasTime && <span className="eyebrow">{when.timeOnly}</span>}
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
          );
        })}
      </TableBody>
    </Table>
  );
};

export default TransactionsTable;
