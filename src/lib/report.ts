// The monthly report: one month of the statements, summed and sorted into
// what a person wants to know at the end of it. What came in, what went out,
// what stayed; where it went; the biggest payments; EMIs and bank charges;
// regular payments that changed or stopped; what is due next month. Every
// number is a sum over the entries, nothing is estimated.

import { chargeKind } from "./charges";
import { OWN_TRANSFER } from "./corrections";
import { payeeName } from "./payees";
import type { Regular } from "./recurring";
import { groupBySpendType, spendType, type SpendBucket } from "./spending";

export type ReportPayment = { name: string; amount: number; date: string; type: string };
export type ReportDue = { name: string; amount: number; date: string; kind: Regular["kind"] };
export type Report = {
  /** YYYY-MM */
  month: string;
  count: number;
  moneyIn: number;
  spent: number;
  invested: number;
  /** Money in minus spending (investments count as kept). */
  kept: number;
  keptRate: number | null;
  byType: SpendBucket[];
  biggest: ReportPayment[];
  emis: { amount: number; count: number };
  charges: { amount: number; count: number };
  /** Regular payments that changed amount, were missed, or stopped. */
  changes: Regular[];
  /** Regular payments and income expected in the month after. */
  nextMonth: ReportDue[];
};

const NOT_INCOME = /refund|reversal|\brev\b|cashback|interest|\bint\b|dividend/i;
const BIGGEST = 5;
const TYPES = 6;
const CHANGES = 6;
const DUE = 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (t: Transaction) => String(t.date).slice(0, 7);

/** The full months the statements cover, newest first: the first and last month are usually part months. */
export function reportMonths(transactions: Transaction[]): string[] {
  const months = [...new Set(transactions.map(monthOf).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  const full = months.length >= 3 ? months.slice(1, -1) : months;
  return full.reverse();
}

/** The month after, YYYY-MM. */
const nextOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
};

/** One month, summed. Null when there is nothing in it. */
export function monthlyReport(transactions: Transaction[], regular: Regular[], month: string): Report | null {
  const rows = transactions.filter((t) => monthOf(t) === month && t.userCategory !== OWN_TRANSFER);
  if (rows.length === 0) return null;

  let moneyIn = 0;
  let spent = 0;
  let invested = 0;
  const emis = { amount: 0, count: 0 };
  const charges = { amount: 0, count: 0 };
  const debits: Transaction[] = [];
  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0);
    const debit = t.type === "debit" || Number(t.amount) < 0;
    if (!debit) {
      if (!NOT_INCOME.test(t.name ?? "")) moneyIn += amount;
      continue;
    }
    debits.push(t);
    const kind = spendType(t);
    if (kind === "Investments") {
      invested += amount;
      continue;
    }
    spent += amount;
    if (kind === "EMI & pay later") {
      emis.amount += amount;
      emis.count++;
    }
    if (kind === "Bank Fees" || chargeKind(t.name ?? "")) {
      charges.amount += amount;
      charges.count++;
    }
  }
  const kept = moneyIn - spent;
  const biggest = debits
    .map((t) => ({
      name: t.shownName || payeeName(t.name ?? ""),
      amount: Math.abs(Number(t.amount) || 0),
      date: String(t.date).slice(0, 10),
      type: spendType(t),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, BIGGEST);

  const next = nextOf(month);
  const nextMonth = regular
    .filter((r) => r.status !== "stopped" && r.next.startsWith(next))
    .map((r) => ({ name: r.name, amount: r.direction === "out" ? -r.amount : r.amount, date: r.next, kind: r.kind }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, DUE);
  const changes = regular.filter((r) => r.changed || r.status === "missed" || r.status === "stopped").slice(0, CHANGES);

  return {
    month,
    count: rows.length,
    moneyIn: round2(moneyIn),
    spent: round2(spent),
    invested: round2(invested),
    kept: round2(kept),
    keptRate: moneyIn > 0 ? kept / moneyIn : null,
    byType: groupBySpendType(rows, TYPES),
    biggest,
    emis: { amount: round2(emis.amount), count: emis.count },
    charges: { amount: round2(charges.amount), count: charges.count },
    changes,
    nextMonth,
  };
}
