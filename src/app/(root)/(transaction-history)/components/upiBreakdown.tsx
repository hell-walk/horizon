"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { chartColorClass } from "@/constants";
import { payeeName } from "@/lib/payees";
import { cn, formatAmount, formatDateTime } from "@/lib/utils";

type Person = { name: string; amount: number; count: number; transactions: Transaction[] };

/**
 * Inside "UPI payments": who the money went to. One bar split by person,
 * then a row per person with their total; tap a person to see each payment.
 */
const UpiBreakdown = ({ transactions, currency }: { transactions: Transaction[]; currency?: string }) => {
  const [open, setOpen] = useState<string | null>(null);

  const byName = new Map<string, Person>();
  for (const t of transactions) {
    const name = payeeName(t.name || "");
    const person = byName.get(name) ?? { name, amount: 0, count: 0, transactions: [] };
    person.amount += Math.abs(Number(t.amount) || 0);
    person.count += 1;
    person.transactions.push(t);
    byName.set(name, person);
  }
  const people = [...byName.values()].sort((a, b) => b.amount - a.amount);
  const total = people.reduce((s, p) => s + p.amount, 0);

  // Colour the five biggest; everyone after that shares grey.
  const colourOf = (i: number) => (i < 5 ? chartColorClass("", i) : chartColorClass("Other", i));

  return (
    <div className="flex flex-col">
      <div className="px-4 pb-3 pt-3">
        <div className="bar-reveal flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-surface-container">
          {people.map((p, i) => (
            <div
              key={p.name}
              title={`${p.name}: ${formatAmount(p.amount, currency)}`}
              className={cn("h-full", colourOf(i))}
              style={{ width: `${total ? (p.amount / total) * 100 : 0}%` }}
            />
          ))}
        </div>
        <p className="eyebrow mt-2">
          {people.length} {people.length === 1 ? "person" : "people"} · {transactions.length} {transactions.length === 1 ? "payment" : "payments"}
        </p>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {people.map((p, i) => {
          const expanded = open === p.name;
          return (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : p.name)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-low"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", colourOf(i))} />
                  <span className="truncate text-14 font-semibold text-ink">{p.name}</span>
                  <span className="eyebrow">×{p.count}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="amount text-14 font-semibold text-ink">{formatAmount(p.amount, currency)}</span>
                  <span className="eyebrow w-9 text-right">{total ? Math.round((p.amount / total) * 100) : 0}%</span>
                  <ChevronDown className={cn("size-4 text-ink-faint transition-transform", expanded && "rotate-180")} />
                </span>
              </button>

              {expanded && (
                <ul className="divide-y divide-line bg-surface-low">
                  {[...p.transactions]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2 pl-10 pr-4">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-13 text-ink">{t.name}</span>
                          <span className="eyebrow">{formatDateTime(new Date(t.date)).dateOnly}</span>
                        </span>
                        <span className="amount shrink-0 text-13 font-semibold text-danger">
                          -{formatAmount(Math.abs(Number(t.amount) || 0), t.currency ?? currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UpiBreakdown;
