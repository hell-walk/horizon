import { OWN_TRANSFER } from "./corrections";
import { spendType } from "./spending";

// Money in, money out and what was left, month by month. Money moved between
// the user's own accounts is neither income nor spending, so it is left out.
// Months with no entries between two that have some are kept (as empty), since
// for statement uploads that usually means a statement is missing.

export type MonthFlow = {
  /** "2026-09" */
  month: string;
  moneyIn: number;
  moneyOut: number;
  /** moneyIn - moneyOut; below zero when more went out than came in. */
  left: number;
  entries: number;
  /** Where most of the money out went, largest first. */
  topSpending: { name: string; amount: number }[];
  /** First and last entry dates in the month (YYYY-MM-DD), when there are entries. */
  from?: string;
  to?: string;
};

const MONTH = /^\d{4}-\d{2}/;
const round2 = (n: number) => Math.round(n * 100) / 100;

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** Month by month, newest first. */
export function monthlyFlow(transactions: Transaction[] = [], top = 3): MonthFlow[] {
  const months = new Map<string, MonthFlow & { spend: Map<string, number> }>();

  for (const t of transactions) {
    const date = String(t.date ?? "");
    if (!MONTH.test(date)) continue;
    const category = spendType(t);
    if (category === OWN_TRANSFER) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!amount) continue;

    const key = date.slice(0, 7);
    const day = date.slice(0, 10);
    const m = months.get(key) ?? { month: key, moneyIn: 0, moneyOut: 0, left: 0, entries: 0, topSpending: [], spend: new Map<string, number>() };
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (isDebit) {
      m.moneyOut += amount;
      m.spend.set(category, (m.spend.get(category) ?? 0) + amount);
    } else {
      m.moneyIn += amount;
    }
    m.entries += 1;
    if (!m.from || day < m.from) m.from = day;
    if (!m.to || day > m.to) m.to = day;
    months.set(key, m);
  }
  if (!months.size) return [];

  // Fill the gaps between the first and last month with empty months.
  const keys = [...months.keys()].sort();
  const out: MonthFlow[] = [];
  for (let key = keys[0]; key <= keys[keys.length - 1]; key = nextMonth(key)) {
    const m = months.get(key);
    if (!m) {
      out.push({ month: key, moneyIn: 0, moneyOut: 0, left: 0, entries: 0, topSpending: [] });
      continue;
    }
    const { spend, ...flow } = m;
    out.push({
      ...flow,
      moneyIn: round2(flow.moneyIn),
      moneyOut: round2(flow.moneyOut),
      left: round2(flow.moneyIn - flow.moneyOut),
      topSpending: [...spend.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .map(([name, amount]) => ({ name, amount: round2(amount) })),
    });
  }
  return out.reverse();
}
