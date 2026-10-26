import { OWN_TRANSFER } from "./corrections";

// Recharges: prepaid mobile and DTH top-ups, by operator. They come back,
// but not on a bill's rhythm: a 28-day pack recharged a few days late each
// time looks like "every 42 days". So the pack's own length decides what a
// month costs and when the next one is due: the length the person gave,
// else the length a known plan of that price has, else the gaps between
// recharges. Pure: the server passes the entries of every account in.

export type RechargePayment = { id: string; date: string; amount: number };
export type Recharge = {
  operator: string;
  /** The usual amount of one recharge (the middle one). */
  amount: number;
  count: number;
  /** Everything paid to it in the statements. */
  total: number;
  /** The gap between recharges, in days (the middle one), once there are two or more. */
  everyDays?: number;
  /** How long one recharge lasts, and where that comes from. */
  validityDays?: number;
  basis: "you" | "plan" | "gaps" | "none";
  /** About how much a month at that rate; absent when nothing says how long a recharge lasts. */
  perMonth?: number;
  last: string;
  /** When the next one is likely: the last one plus the validity. */
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
export const OPERATOR_NAMES = OPERATORS.map(([, name]) => name);
const NOT_RECHARGE = /postpaid|broadband|fiber|fibre|wifi|bill\s*pay|billdesk/i;

/** The operator a debit's narration names, when it is a recharge. */
export const rechargeOperator = (name: string): string | undefined => (NOT_RECHARGE.test(name) ? undefined : OPERATORS.find(([re]) => re.test(name))?.[1]);

/**
 * How long the common prepaid plans last, by operator and price (rupees).
 * Prices change: this is a first guess the person can correct, never the last
 * word. Only plans whose length is well known are listed.
 */
const PLAN_DAYS: Record<string, Record<number, number>> = {
  Jio: { 189: 28, 239: 28, 299: 28, 349: 28, 449: 28, 479: 56, 579: 56, 799: 84, 899: 90, 999: 98, 3599: 365 },
  Airtel: { 199: 28, 299: 28, 349: 28, 379: 28, 409: 28, 449: 28, 579: 56, 649: 56, 859: 84, 979: 84, 1799: 365, 1999: 365, 3599: 365 },
  Vi: { 199: 28, 299: 28, 349: 28, 449: 28, 579: 56, 859: 84, 979: 84, 1799: 365, 3599: 365 },
  BSNL: { 2399: 395 },
};

export type PlanRow = { operator: string; price: number; days: number };

// Plans the team adds from the admin portal (the shared "terms" table, group
// "recharge", one row per plan written "Operator|price|days", for example
// "Jio|349|28"). Filled by server/terms.ts at the start of a request; they
// win over the built-in table, so a price change is fixed without a deploy.
let extraPlans: PlanRow[] = [];
export const setExtraPlans = (rows: PlanRow[]) => {
  extraPlans = rows;
};

/** One portal row into a plan, or null when it is not "Operator|price|days" with sane numbers. */
export function parsePlanTerm(term: string): PlanRow | null {
  const [operator, price, days] = String(term)
    .split("|")
    .map((s) => s.trim());
  const p = Number(price);
  const d = Number(days);
  if (!operator || operator.length > 40 || !Number.isFinite(p) || p <= 0 || p > 100_000 || !Number.isInteger(d) || d < 1 || d > 400) return null;
  return { operator, price: p, days: d };
}

/** The length of a known plan at this price (within 2%), if any: the portal's rows first, then the built-in table. */
export function planDays(operator: string, amount: number): number | undefined {
  const close = (price: number) => Math.abs(amount - price) <= price * 0.02;
  const extra = extraPlans.find((p) => p.operator.toLowerCase() === operator.toLowerCase() && close(p.price));
  if (extra) return extra.days;
  const plans = PLAN_DAYS[operator];
  if (!plans) return undefined;
  const hit = Object.entries(plans).find(([price]) => close(Number(price)));
  return hit ? hit[1] : undefined;
}

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Every recharge across the entries, costliest a month first. `days`: the
 * plan lengths the person set, by operator (they win over the plan table and
 * the gaps).
 */
export function rechargePicture(transactions: Transaction[], days: Record<string, number> = {}): RechargePicture {
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
    const dayNumbers = payments.map((p) => dayOf(p.date));
    const gaps = dayNumbers
      .slice(1)
      .map((d, i) => d - dayNumbers[i])
      .filter((g) => g > 0);
    const everyDays = gaps.length ? Math.round(median(gaps)) : undefined;
    const amount = round2(median(amounts));
    const last = payments[payments.length - 1].date;
    const given = days[operator];
    const known = planDays(operator, amount);
    const [validityDays, basis]: [number | undefined, Recharge["basis"]] =
      given && given > 0 ? [given, "you"] : known ? [known, "plan"] : everyDays ? [everyDays, "gaps"] : [undefined, "none"];
    items.push({
      operator,
      amount,
      count: payments.length,
      total: round2(amounts.reduce((s, a) => s + a, 0)),
      ...(everyDays ? { everyDays } : {}),
      ...(validityDays ? { validityDays, perMonth: round2((amount * 30.44) / validityDays), next: iso(dayOf(last) + validityDays) } : {}),
      basis,
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
