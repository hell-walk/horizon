import { OWN_TRANSFER } from "./corrections";

// Recharges: prepaid mobile and DTH top-ups, by operator. Each recharge is its
// own plan: the latest one decides what the person is on now, how long it
// lasts (their word, else a known plan of that price, else the gaps between
// recharges of that price) and so when the next is due and what a month costs.
// A recharge bought late does not stretch the plan: a 28-day pack bought every
// 42 days still costs 349 × 30.44 / 28 a month while it runs.
// Two things look like recharges and are not: small add-ons (extra data or
// talk time on top of a plan, they do not move the plan) and bills. Prepaid
// prices already hold the GST, so a recharge is whole rupees; wifi (JioFiber,
// AirFiber, Xstream) and postpaid bills add 18% on top and end in paise
// (₹899 + GST = ₹1,060.82). Pure: the server passes the entries of every account in.

export type RechargeBasis = "you" | "plan" | "gaps" | "none";
export type RechargePayment = {
  id: string;
  date: string;
  amount: number;
  /** An add-on rides on the plan in force; it never becomes the plan. */
  kind: "plan" | "addOn";
  /** How long this recharge lasts, when that is known. */
  days?: number;
};
export type Recharge = {
  operator: string;
  /** The price of the plan the person is on now (their latest plan recharge). */
  amount: number;
  /** When that plan was bought. */
  since: string;
  /** How long it lasts, and where that comes from. */
  validityDays?: number;
  basis: RechargeBasis;
  /** About how much a month on that plan; absent when nothing says how long it lasts. */
  perMonth?: number;
  /** When it runs out: the day it was bought plus its length. */
  next?: string;
  /** It ran out a while before the statements end, with no recharge after it. */
  lapsed: boolean;
  count: number;
  addOns: number;
  /** Everything paid to it in the statements, add-ons included. */
  total: number;
  first: string;
  /** The latest recharge of any kind. */
  last: string;
  /** Newest first, at most 24. */
  payments: RechargePayment[];
};
export type LeftOutBill = { id: string; operator: string; date: string; amount: number };
export type RechargePicture = {
  items: Recharge[];
  /** A month at the plans still running. */
  monthly: number;
  total: number;
  count: number;
  /** Payments to an operator with GST on top: wifi or postpaid bills, left out. */
  leftOut: LeftOutBill[];
  /** The newest entry in the statements: what "lapsed" is measured against. */
  asOf?: string;
};

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

/** GST added on top, so a bill (wifi, postpaid), not a prepaid recharge: prepaid prices are whole rupees. */
export const looksLikeBill = (amount: number) => Math.abs(amount * 100 - Math.round(amount) * 100) >= 1;

/** Below this, a recharge that is no known plan is an add-on (extra data or talk time). */
const ADD_ON_BELOW = 150;

/**
 * How long the common prepaid plans last, by operator and price (rupees).
 * Prices change: this is a first guess the person can correct, never the last
 * word. Only plans whose length is well known are listed.
 */
const PLAN_DAYS: Record<string, Record<number, number>> = {
  Jio: { 189: 28, 239: 28, 299: 28, 349: 28, 399: 28, 449: 28, 479: 56, 579: 56, 629: 56, 719: 70, 799: 84, 899: 90, 999: 98, 1028: 84, 1029: 84, 1049: 84, 1199: 84, 3599: 365 },
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

/** Where the person's own plan length is kept: per operator and price, since each plan has its own. */
export const rechargeDaysKey = (operator: string, price: number) => `${operator}|${Math.round(price)}`;

const DAY = 86_400_000;
/** A plan that ran out more than this before the statements end, with nothing after it, has lapsed. */
const LAPSED_AFTER_DAYS = 7;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Every recharge across the entries, costliest a month first. `days`: the plan
 * lengths the person set, keyed by rechargeDaysKey (an operator alone, as
 * saved before plans had their own, still counts for the current plan).
 */
export function rechargePicture(transactions: Transaction[], days: Record<string, number> = {}): RechargePicture {
  const groups = new Map<string, { id: string; date: string; amount: number }[]>();
  const leftOut: LeftOutBill[] = [];
  let asOf: string | undefined;
  for (const t of transactions) {
    const date = String(t.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!asOf || date > asOf) asOf = date;
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!isDebit || !amount || t.userCategory === OWN_TRANSFER) continue;
    const operator = rechargeOperator(t.shownName ? `${t.shownName} ${t.name}` : t.name);
    if (!operator) continue;
    if (looksLikeBill(amount)) {
      leftOut.push({ id: t.id, operator, date, amount });
      continue;
    }
    groups.set(operator, [...(groups.get(operator) ?? []), { id: t.id, date, amount }]);
  }

  const items: Recharge[] = [];
  for (const [operator, rows] of groups) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const given = (price: number) => days[rechargeDaysKey(operator, price)];
    const payments: RechargePayment[] = rows.map((r) => {
      const length = given(r.amount) || planDays(operator, r.amount);
      return { ...r, kind: !length && r.amount < ADD_ON_BELOW ? "addOn" : "plan", ...(length ? { days: length } : {}) };
    });
    const plans = payments.filter((p) => p.kind === "plan");
    // Only add-ons seen: the latest of them stands in, so the operator still shows.
    const current = plans.at(-1) ?? payments.at(-1)!;

    // The gaps between recharges of this same price, for a price no table knows.
    const samePrice = plans.filter((p) => Math.abs(p.amount - current.amount) <= current.amount * 0.02).map((p) => dayOf(p.date));
    const gaps = samePrice
      .slice(1)
      .map((d, i) => d - samePrice[i])
      .filter((g) => g > 0 && g <= 400);
    const own = given(current.amount) || days[operator];
    const known = planDays(operator, current.amount);
    const [validityDays, basis]: [number | undefined, RechargeBasis] =
      own && own > 0 ? [own, "you"] : known ? [known, "plan"] : gaps.length ? [Math.round(median(gaps)), "gaps"] : [undefined, "none"];
    const next = validityDays ? iso(dayOf(current.date) + validityDays) : undefined;
    const lapsed = !!(next && asOf && dayOf(asOf) - dayOf(next) > LAPSED_AFTER_DAYS);
    const amounts = rows.map((r) => r.amount);

    items.push({
      operator,
      amount: current.amount,
      since: current.date,
      ...(validityDays ? { validityDays, perMonth: round2((current.amount * 30.44) / validityDays), next } : {}),
      basis,
      lapsed,
      count: rows.length,
      addOns: payments.length - plans.length,
      total: round2(amounts.reduce((s, a) => s + a, 0)),
      first: rows[0].date,
      last: rows[rows.length - 1].date,
      payments: payments.slice().reverse().slice(0, 24),
    });
  }
  items.sort((a, b) => Number(a.lapsed) - Number(b.lapsed) || (b.perMonth ?? 0) - (a.perMonth ?? 0) || b.total - a.total);
  return {
    items,
    monthly: round2(items.reduce((s, i) => s + (i.lapsed ? 0 : (i.perMonth ?? 0)), 0)),
    total: round2(items.reduce((s, i) => s + i.total, 0)),
    count: items.reduce((s, i) => s + i.count, 0),
    leftOut: leftOut.sort((a, b) => b.date.localeCompare(a.date)),
    ...(asOf ? { asOf } : {}),
  };
}
