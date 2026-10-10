"use client";

import { Columns3 } from "lucide-react";

import type { StatementMapping, StatementSample } from "@/lib/statements/parse";
import { cn } from "@/lib/utils";

import { useT } from "./i18nProvider";

type Role = keyof StatementMapping;

// labelKey is shown through t().
const ROLES: { role: Role; labelKey: string }[] = [
  { role: "date", labelKey: "connect.roleDate" },
  { role: "name", labelKey: "connect.roleName" },
  { role: "debit", labelKey: "connect.roleDebit" },
  { role: "credit", labelKey: "connect.roleCredit" },
  { role: "amount", labelKey: "connect.roleAmount" },
  { role: "type", labelKey: "connect.roleType" },
  { role: "balance", labelKey: "connect.roleBalance" },
  { role: "reference", labelKey: "connect.roleReference" },
];

const roleOf = (mapping: Partial<StatementMapping>, column: number) =>
  (Object.entries(mapping).find(([, index]) => index === column)?.[0] as Role | undefined) ?? "";

/**
 * What is still missing before the file can be read, mirroring the server's check.
 * Returns the message key (show it with t()), or null when nothing is missing.
 */
export function mappingHint(mapping: Partial<StatementMapping>): string | null {
  if (mapping.date === undefined) return "connect.mapNeedDate";
  if (mapping.name === undefined) return "connect.mapNeedName";
  if (mapping.debit === undefined && mapping.credit === undefined && mapping.amount === undefined) return "connect.mapNeedAmount";
  return null;
}

type Props = {
  sample: StatementSample;
  mapping: Partial<StatementMapping>;
  onChange: (mapping: Partial<StatementMapping>) => void;
};

/**
 * The file's first rows with a role picker above each column. Each role goes to
 * one column only: picking it again moves it.
 */
const ColumnMapper = ({ sample, mapping, onChange }: Props) => {
  const t = useT();
  const setRole = (column: number, role: Role | "") => {
    const next: Partial<StatementMapping> = {};
    for (const [key, index] of Object.entries(mapping) as [Role, number | undefined][]) {
      if (index !== undefined && index !== column && key !== role) next[key] = index;
    }
    if (role) next[role] = column;
    onChange(next);
  };

  const hint = mappingHint(mapping);
  const columns = [...Array(sample.width).keys()];

  return (
    <div className="panel overflow-hidden">
      <header className="panel-head">
        <span className="eyebrow flex items-center gap-1.5">
          <Columns3 className="size-3.5" /> {t("connect.mapTitle")}
        </span>
        <span className="eyebrow">{t("connect.mapRemembered")}</span>
      </header>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("connect.tableScrolls")}>
        <table className="w-full text-12">
          <thead>
            <tr className="border-b border-line bg-surface-low">
              {columns.map((j) => {
                const role = roleOf(mapping, j);
                return (
                  <th key={j} className="min-w-[120px] px-2 py-2 text-left align-top font-normal">
                    <select
                      aria-label={
                        sample.labels[j] ? t("connect.mapColumnNamed", { number: j + 1, label: sample.labels[j] }) : t("connect.mapColumn", { number: j + 1 })
                      }
                      value={role}
                      onChange={(e) => setRole(j, e.target.value as Role | "")}
                      className={cn(
                        "field-input h-8 w-full px-2 py-0 text-12",
                        role ? "border-primary font-semibold text-ink" : "text-ink-faint"
                      )}
                    >
                      <option value="">{t("connect.mapSkip")}</option>
                      {ROLES.map(({ role: r, labelKey }) => (
                        <option key={r} value={r}>
                          {t(labelKey)}
                        </option>
                      ))}
                    </select>
                    {sample.labels[j] && (
                      <span translate="no" className="mt-1 block truncate text-12 text-ink-muted">
                        {sample.labels[j]}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sample.rows.map((row, i) => (
              <tr key={i}>
                {columns.map((j) => (
                  <td
                    key={j}
                    translate="no"
                    className={cn(
                      "max-w-[220px] truncate px-2 py-1.5 font-mono text-ink-muted",
                      roleOf(mapping, j) && "bg-surface-low text-ink"
                    )}
                  >
                    {row[j] || <span className="text-ink-faint">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={cn("border-t border-line px-3 py-2 text-12", hint ? "text-warn-ink" : "text-ink-muted")}>
        {hint
          ? t(hint)
          : mapping.amount !== undefined && mapping.type === undefined && mapping.balance !== undefined
            ? t("connect.mapReadyBalance")
            : t("connect.mapReady")}
      </p>
    </div>
  );
};

export default ColumnMapper;
