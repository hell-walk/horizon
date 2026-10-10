"use client";

import { Columns3 } from "lucide-react";

import type { StatementMapping, StatementSample } from "@/lib/statements/parse";
import { cn } from "@/lib/utils";

type Role = keyof StatementMapping;

const ROLES: { role: Role; label: string }[] = [
  { role: "date", label: "Date" },
  { role: "name", label: "Description" },
  { role: "debit", label: "Money out" },
  { role: "credit", label: "Money in" },
  { role: "amount", label: "Amount (+/−)" },
  { role: "type", label: "Dr / Cr" },
  { role: "balance", label: "Balance" },
  { role: "reference", label: "Reference" },
];

const roleOf = (mapping: Partial<StatementMapping>, column: number) =>
  (Object.entries(mapping).find(([, index]) => index === column)?.[0] as Role | undefined) ?? "";

/** What is still missing before the file can be read, mirroring the server's check. */
export function mappingHint(mapping: Partial<StatementMapping>): string | null {
  if (mapping.date === undefined) return "Choose the date column.";
  if (mapping.name === undefined) return "Choose the description column.";
  if (mapping.debit === undefined && mapping.credit === undefined && mapping.amount === undefined)
    return "Choose money out and money in, or a single amount column.";
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
          <Columns3 className="size-3.5" /> Which column is which?
        </span>
        <span className="eyebrow">Remembered for files like this</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-12">
          <thead>
            <tr className="border-b border-line bg-surface-low">
              {columns.map((j) => {
                const role = roleOf(mapping, j);
                return (
                  <th key={j} className="min-w-[120px] px-2 py-2 text-left align-top font-normal">
                    <select
                      aria-label={`Column ${j + 1}${sample.labels[j] ? ` (${sample.labels[j]})` : ""}`}
                      value={role}
                      onChange={(e) => setRole(j, e.target.value as Role | "")}
                      className={cn(
                        "field-input h-8 w-full px-2 py-0 text-12",
                        role ? "border-primary font-semibold text-ink" : "text-ink-faint"
                      )}
                    >
                      <option value="">Skip</option>
                      {ROLES.map(({ role: r, label }) => (
                        <option key={r} value={r}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {sample.labels[j] && <span className="mt-1 block truncate text-11 text-ink-muted">{sample.labels[j]}</span>}
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
      <p className={cn("border-t border-line px-3 py-2 text-12", hint ? "text-warn" : "text-ink-muted")}>
        {hint ??
          (mapping.amount !== undefined && mapping.type === undefined && mapping.balance !== undefined
            ? "Ready. The balance column tells Horizon which amounts were money out."
            : "Ready. Read the file again with these columns.")}
      </p>
    </div>
  );
};

export default ColumnMapper;
