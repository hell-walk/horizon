import { OWN_TRANSFER } from "./corrections";

// Recharges: prepaid mobile and DTH top-ups, by operator. They come back,
// but not on a bill's rhythm: a 28-day pack, an 84-day pack, a top-up when
// the data runs out. So they are read by the operator's name rather than by
// rhythm, and the rhythm is estimated from the gaps. Pure: the server passes
// the entries of every account in.

export type RechargePayment = { id: string; date: string; amount: number };
export type Recharge = {
  operator: string;
  /** The usual amount of one recharge (the middle one). */
  amount: number;
  count: number;
  /** Everything paid to it in the statements. */
  total: number;
  /** About how often, in days (the middle gap), once there are two or more. */
  everyDays?: number;
  /** About how much a month at that rate; absent when seen once. */
  perMonth?: number;
  last: string;
  /** When the next one is likely, from the last one and the usual gap. */
  next?: string;
  /** Newest first, at most twelve. */
  payments: RechargePayment[];
};
export type RechargePicture = { items: Recharge[]; monthly: number; total: number; count: number };

/** Operators, by what banks write; postpaid and broadband are bills, not recharges, and are left out. */
const OPERATORS: [RegExp, string][] = [
  [/myjio|\bjio\s*prep|\bjio\b(?!\s*(cinema|hotstar|saavn|mart|fin))/i, "Jio"],
  [/airtel(?!\s*(payments?\s*bank|money|thanks))/i, "Airtel"],
  [/\bvi\s*(prepaid|recharg|mobile)|vodafone|\bidea\s*(cellular|prepaid|recharg)/i, "Vi"],
  [/\bbsnl\b|\bmtnl\b/i, "BSNL"],
  [/tata\s*play|tata\s*sky|tatasky/i, "Tata Play"],
  [/dish\s*tv|dishtv/i, "Dish TV"],
  [/\bd2h\b|videocon/i, "d2h"],
  [/sun\s*direct/i, "Sun Direct"],
  [/\brechar|prepaid|top-?up/i, "Recharge"],
];
const NOT_RECHARGE = /postpaid|broadband|fiber|fibre|wifi|bill\s*pay|billdesk/i;

/** The operator a debit's narration names, when it is a recharge. */
export const rechargeOperator = (name: string): string | undefined => (NOT_RECHARGE.test(name) ? undefined : OPERATORS.find(([re]) => re.test(name))?.[1]);

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Every recharge across the entries, costliest a month first. */
export function rechargePicture(transactions: Transaction[]): RechargePicture {
  const groups = new Map<string, RechargePayment[]>();
  for (const t of transactions) {
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!isDebit || !amount || t.userCategory === OWN_TRANSFER) continue;
    const date = String(t.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const operator = rechargeOperator(t.shownName ? `${t.shownName} ${t.name}` : t.name);
    if (!operator) continue;
    groups.set(operator, [...(groups.get(operator) ?? []), { id: t.id, date, amount }]);
  }

  const items: Recharge[] = [];
  for (const [operator, payments] of groups) {
    payments.sort((a, b) => a.date.localeCompare(b.date));
    const amounts = payments.map((p) => p.amount);
    const days = payments.map((p) => dayOf(p.date));
    const gaps = days
      .slice(1)
      .map((d, i) => d - days[i])
      .filter((g) => g > 0);
    const everyDays = gaps.length ? Math.round(median(gaps)) : undefined;
    const amount = round2(median(amounts));
    const last = payments[payments.length - 1].date;
    items.push({
      operator,
      amount,
      count: payments.length,
      total: round2(amounts.reduce((s, a) => s + a, 0)),
      ...(everyDays ? { everyDays, perMonth: round2((amount * 30.44) / everyDays), next: iso(dayOf(last) + everyDays) } : {}),
      last,
      payments: payments.slice().reverse().slice(0, 12),
    });
  }
  items.sort((a, b) => (b.perMonth ?? 0) - (a.perMonth ?? 0) || b.total - a.total);
  return {
    items,
    monthly: round2(items.reduce((s, i) => s + (i.perMonth ?? 0), 0)),
    total: round2(items.reduce((s, i) => s + i.total, 0)),
    count: items.reduce((s, i) => s + i.count, 0),
  };
}
