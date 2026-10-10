import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import type { BalanceCheck } from "@/lib/statements/parse";
import { cn, formatAmount } from "@/lib/utils";

/**
 * The statement's proof: opening balance + money in − money out = closing
 * balance, row by row. Shown in the import preview so a misread file is
 * caught before anything is saved.
 */
const BalanceCheckNote = ({ check, currency }: { check: BalanceCheck; currency: string }) => {
  const money = (n?: number) => (n === undefined ? "—" : formatAmount(n, currency));

  if (check.status === "unchecked") {
    return (
      <div className="flex items-start gap-2 border-t border-line px-3 py-2.5 text-12 text-ink-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          This file has no running balance, so the rows cannot be cross-checked. In {money(check.totalIn)} · out {money(check.totalOut)}.
        </span>
      </div>
    );
  }

  const ok = check.status === "ok";
  return (
    <div className={cn("flex flex-col gap-1.5 border-t px-3 py-2.5 text-12", ok ? "border-success/30 bg-success-soft/50" : "border-warn/30 bg-warn-soft/60")}>
      <div className="flex items-start gap-2">
        {ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />}
        <span className="text-ink">
          {ok ? "Balances add up. " : `${check.mismatches.length} ${check.mismatches.length === 1 ? "row doesn't" : "rows don't"} add up. `}
          <span className="amount">
            {money(check.opening)} + {money(check.totalIn)} − {money(check.totalOut)} = {money(check.closing)}
          </span>
        </span>
      </div>
      {!ok && (
        <ul className="flex flex-col gap-0.5 pl-[22px] text-ink-muted">
          {check.mismatches.slice(0, 3).map((m) => (
            <li key={`${m.date}-${m.name}`} className="truncate">
              {m.date} · {m.name}: balance shows <span className="amount text-ink">{money(m.actual)}</span>, expected{" "}
              <span className="amount text-ink">{money(m.expected)}</span>
            </li>
          ))}
          {check.mismatches.length > 3 && <li>and {check.mismatches.length - 3} more</li>}
          <li className="pt-0.5">A row may be misread or missing. You can still import, or check the file first.</li>
        </ul>
      )}
    </div>
  );
};

export default BalanceCheckNote;
