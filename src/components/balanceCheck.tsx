import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { BalanceCheck } from "@/lib/statements/parse";
import { cn, formatAmount } from "@/lib/utils";

import { useT } from "./i18nProvider";

/** Puts data (money) into a translated sentence at its {placeholder}, as its own element. */
const fill = (text: string, data: Record<string, ReactNode>) =>
  text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in data ? data[name] : part}</Fragment>;
  });

/**
 * The statement's proof: opening balance + money in − money out = closing
 * balance, row by row. Shown in the import preview so a misread file is
 * caught before anything is saved.
 */
const BalanceCheckNote = ({ check, currency }: { check: BalanceCheck; currency: string }) => {
  const t = useT();
  const money = (n?: number) => (n === undefined ? "—" : formatAmount(n, currency));
  const amount = (n?: number, className = "amount") => (
    <span translate="no" className={className}>
      {money(n)}
    </span>
  );

  if (check.status === "unchecked") {
    return (
      <div className="flex items-start gap-2 border-t border-line px-3 py-2.5 text-12 text-ink-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{fill(t("connect.checkUnchecked"), { in: amount(check.totalIn), out: amount(check.totalOut) })}</span>
      </div>
    );
  }

  const ok = check.status === "ok";
  return (
    <div className={cn("flex flex-col gap-1.5 border-t px-3 py-2.5 text-12", ok ? "border-success/30 bg-success-soft/50" : "border-warn/30 bg-warn-soft/60")}>
      <div className="flex items-start gap-2">
        {ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn-ink" />}
        <span className="text-ink">
          {ok ? t("connect.checkOk") : t("connect.checkBad", { count: check.mismatches.length })}{" "}
          <span translate="no" className="amount">
            {money(check.opening)} + {money(check.totalIn)} − {money(check.totalOut)} = {money(check.closing)}
          </span>
        </span>
      </div>
      {!ok && (
        <ul className="flex flex-col gap-0.5 pl-[22px] text-ink-muted">
          {check.mismatches.slice(0, 3).map((m) => (
            <li key={`${m.date}-${m.name}`} className="truncate">
              <span translate="no">
                {m.date} · {m.name}
              </span>
              : {fill(t("connect.checkRow"), { actual: amount(m.actual, "amount text-ink"), expected: amount(m.expected, "amount text-ink") })}
            </li>
          ))}
          {check.mismatches.length > 3 && <li>{t("connect.checkMore", { count: check.mismatches.length - 3 })}</li>}
          <li className="pt-0.5">{t("connect.checkAdvice")}</li>
        </ul>
      )}
    </div>
  );
};

export default BalanceCheckNote;
