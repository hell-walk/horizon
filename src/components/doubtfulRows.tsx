"use client";

import { AlertTriangle, Pencil, Undo2 } from "lucide-react";
import { useId, useState } from "react";

import type { DoubtfulRow } from "@/lib/actions/statement.action";
import type { DoubtReason, Fixes, RowFix } from "@/lib/statements/doubtful";
import { cn, formatAmount } from "@/lib/utils";

import { useT } from "./i18nProvider";

type Props = {
  count: number;
  rows: DoubtfulRow[];
  total: number;
  currency: string;
  fixes: Fixes;
  onFix: (index: number, fix: RowFix | null) => void;
  skipAll: boolean;
  onSkipAll: (skip: boolean) => void;
};

const REASON_KEY: Record<DoubtReason, string> = {
  balance: "connect.doubtBalance",
  future: "connect.doubtFuture",
  farDate: "connect.doubtFarDate",
  bigAmount: "connect.doubtBigAmount",
  noName: "connect.doubtNoName",
};

const touched = (fix?: RowFix) => !!fix && (fix.date !== undefined || fix.amount !== undefined || fix.type !== undefined);

/**
 * Rows the reader is not sure about, each with why, the likely fix when there
 * is one, and the choice to change it, skip it, or keep it as it is.
 */
const DoubtfulRows = ({ count, rows, total, currency, fixes, onFix, skipAll, onSkipAll }: Props) => {
  const t = useT();
  const money = (n: number) => formatAmount(n, currency);
  const manyWrong = count > Math.max(5, total * 0.2);
  // Every row has an answer: changed, skipped or (with "skip every row") left out.
  const handled =
    count === rows.length && rows.every((r) => touched(fixes[r.index]) || fixes[r.index]?.skip === true || (skipAll && fixes[r.index]?.skip !== false));

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-warn/10 px-3 py-3 text-13 text-ink">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{handled ? t("connect.doubtHandled", { count }) : t("connect.doubtTitle", { count })}</p>
          <p>{t("connect.doubtBody")}</p>
          {manyWrong && <p className="font-semibold text-warn-ink">{t("connect.doubtManyWrong")}</p>}
        </div>
      </div>

      <label className="flex items-start gap-2">
        <input type="checkbox" checked={skipAll} onChange={(e) => onSkipAll(e.target.checked)} className="mt-0.5 size-4" />
        {t("connect.doubtSkipAll")}
      </label>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <Row key={row.index} row={row} fix={fixes[row.index]} onFix={(fix) => onFix(row.index, fix)} skipAll={skipAll} money={money} />
        ))}
      </ul>
      {count > rows.length && <p className="text-ink-muted">{t("connect.doubtMore", { shown: rows.length, count: count - rows.length })}</p>}
    </div>
  );
};

const Row = ({
  row,
  fix,
  onFix,
  skipAll,
  money,
}: {
  row: DoubtfulRow;
  fix?: RowFix;
  onFix: (fix: RowFix | null) => void;
  skipAll: boolean;
  money: (n: number) => string;
}) => {
  const t = useT();
  const ids = useId();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(row.date);
  const [amount, setAmount] = useState(String(row.amount));
  const [type, setType] = useState(row.type);

  const changed = touched(fix);
  const skipped = fix?.skip === true || (skipAll && !changed && fix?.skip !== false);
  const shown = { date: fix?.date ?? row.date, amount: fix?.amount ?? row.amount, type: fix?.type ?? row.type };
  const s = row.suggestion;

  const save = () => {
    const value = Number(amount.replace(/,/g, ""));
    const next: RowFix = {};
    if (date && date !== row.date) next.date = date;
    if (Number.isFinite(value) && value > 0 && value !== row.amount) next.amount = value;
    if (type !== row.type) next.type = type;
    onFix(Object.keys(next).length ? next : null);
    setEditing(false);
  };

  return (
    <li className={cn("flex flex-col gap-2 rounded-md border border-line bg-card p-3", skipped && "opacity-70")}>
      <p translate="no" className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-12 text-ink-muted">{row.date}</span>
        <span className="min-w-0 break-words font-semibold">{row.name || "—"}</span>
        <span className={cn("amount ml-auto font-semibold", row.type === "debit" ? "text-danger" : "text-success")}>
          {row.type === "debit" ? "-" : "+"}
          {money(row.amount)}
        </span>
      </p>

      <ul className="flex flex-col gap-1 text-ink-muted">
        {row.reasons.map((reason) => (
          <li key={reason}>
            {reason === "balance" && row.expected !== undefined && row.actual !== undefined
              ? t(REASON_KEY[reason], { expected: money(row.expected), actual: money(row.actual) })
              : t(REASON_KEY[reason])}
          </li>
        ))}
      </ul>

      {skipped ? (
        <p className="font-semibold">{t("connect.doubtWillSkip")}</p>
      ) : changed ? (
        <p>
          {t("connect.doubtWillSave")}{" "}
          <span translate="no" className="font-semibold">
            {shown.date} · {shown.type === "debit" ? "-" : "+"}
            {money(shown.amount)}
          </span>
        </p>
      ) : null}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          {!changed && !skipped && s?.type && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onFix({ type: s.type })}>
              {s.type === "credit" ? t("connect.doubtMakeIn") : t("connect.doubtMakeOut")}
            </button>
          )}
          {!changed && !skipped && s?.amount !== undefined && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onFix({ amount: s.amount })}>
              {t("connect.doubtUseAmount", { amount: money(s.amount) })}
            </button>
          )}
          {!changed && !skipped && s?.date && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onFix({ date: s.date })}>
              {t("connect.doubtUseDate", { date: s.date })}
            </button>
          )}
          {!skipped && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                // Start from what will be saved now, including a fix already chosen.
                setDate(shown.date);
                setAmount(String(shown.amount));
                setType(shown.type);
                setEditing(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden /> {t("connect.doubtChange")}
            </button>
          )}
          {changed && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onFix(null)}>
              <Undo2 className="size-3.5" aria-hidden /> {t("connect.doubtUndo")}
            </button>
          )}
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={skipped}
              onChange={(e) => onFix(e.target.checked ? { skip: true } : skipAll ? { skip: false } : null)}
              className="size-4"
            />
            {t("connect.doubtSkip")}
          </label>
        </div>
      )}

      {editing && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="field">
            <label className="field-label" htmlFor={`${ids}-date`}>
              {t("connect.colDate")}
            </label>
            <input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${ids}-amount`}>
              {t("connect.colAmount")}
            </label>
            <input id={`${ids}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${ids}-type`}>
              {t("connect.doubtDirection")}
            </label>
            <select id={`${ids}-type`} value={type} onChange={(e) => setType(e.target.value as "debit" | "credit")} className="field-input">
              <option value="debit">{t("connect.doubtMoneyOut")}</option>
              <option value="credit">{t("connect.doubtMoneyIn")}</option>
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" className="btn-primary btn-sm" onClick={save}>
              {t("connect.doubtApply")}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default DoubtfulRows;
