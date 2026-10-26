import { isPayLater } from "./categories";
import { OWN_TRANSFER, payeeKey } from "./corrections";
import { isStore } from "./planNames";
import { payeeName } from "./payees";
import { isTelecom, looksLikeBill } from "./recharges";
import { spendType } from "./spending";

// Payments that come back on a rhythm: rent, EMIs, subscriptions, bills,
// salary. Found from the entries themselves (no outside service): the same
// payee, the same direction, at a steady interval. Every result carries the
// payments it was found from, so the user can see why we think so.
//
// Statements are uploaded by hand and often end some weeks ago, so "missed"
// is judged against the last date the statements cover, not against today:
// a payment due after that date is "not in your statements yet", not late.

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";
export type RegularKind = "income" | "emi" | "rent" | "subscription" | "bill" | "saving" | "own" | "other";
export type RegularStatus = "upcoming" | "unseen" | "missed" | "stopped";

export type Regular = {
  key: string;
  name: string;
  kind: RegularKind;
  /** A telecom payee's bills (wifi or postpaid: GST on top), kept apart from its prepaid recharges. */
  variant?: "wifiOrPostpaid";
  direction: "in" | "out";
  cadence: Cadence;
  /** The usual amount (the middle one). */
  amount: number;
  /** Every payment within 5% of the usual amount. */
  fixedAmount: boolean;
  /** About how much this is per month, whatever the cadence. */
  perMonth: number;
  count: number;
  /** "high": three or more, at a steady interval. "low": seen twice so far. */
  confidence: "high" | "low";
  last: { date: string; amount: number };
  /** When the next one is expected (YYYY-MM-DD). */
  next: string;
  status: RegularStatus;
  /** For "missed" and "stopped": when the first payment that did not come was expected. */
  missedSince?: string;
  /** The last amount, when it differs from a steady amount before it. */
  changed?: { from: number; to: number };
  /** The payments this was found from, newest first. */
  seen: { id: string; date: string; amount: number }[];
};

const DAY = 86_400_000;
const BANDS: Record<Cadence, [number, number]> = { weekly: [6, 8], monthly: [25, 35], quarterly: [84, 98], yearly: [350, 380] };
const GRACE: Record<Cadence, number> = { weekly: 3, monthly: 7, quarterly: 14, yearly: 30 };
const PER_MONTH: Record<Cadence, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
const MONTHS: Record<Cadence, number> = { weekly: 0, monthly: 1, quarterly: 3, yearly: 12 };

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const within = (value: number, around: number, share: number) => Math.abs(value - around) <= around * share;

/** The same day of the month, n months later (the 31st becomes the month's last day). */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

const nextAfter = (date: string, cadence: Cadence) => (cadence === "weekly" ? iso(dayOf(date) + 7) : addMonths(date, MONTHS[cadence]));

/**
 * Which rhythm the gaps follow, if any: at least half the gaps inside one
 * band, and nearly all of them either in it, a little late (a payment that
 * went through some days after its day) or two periods long (one missing).
 */
function cadenceOf(gaps: number[]): Cadence | null {
  for (const cadence of ["monthly", "weekly", "quarterly", "yearly"] as Cadence[]) {
    const [lo, hi] = BANDS[cadence];
    const inBand = gaps.filter((g) => g >= lo && g <= hi).length;
    const late = gaps.filter((g) => g > hi && g <= hi * 1.25).length;
    const doubled = gaps.filter((g) => g >= lo * 2 && g <= hi * 2).length;
    if (inBand >= Math.ceil(gaps.length / 2) && inBand + late + doubled >= Math.ceil(gaps.length * 0.75)) return cadence;
  }
  return null;
}

type Row = { tx: Transaction; day: number; amount: number };

/**
 * One subscription merchant, several subscriptions: everything billed through
 * Google Play or Apple arrives under one name, each plan at its own steady
 * amount. Such a payee's payments are split by amount (within 5% of each
 * other), each tier its own regular payment, keyed "<payee>#2", "#3"...
 * A lone payment at some other amount is a one-off purchase and is dropped,
 * unless it is the newest one (a price change). A payee with one plan, or
 * whose amounts never repeat, is left as it was.
 */
function splitByAmount(rows: Row[]): Row[][] {
  const sorted = rows.slice().sort((a, b) => a.amount - b.amount);
  const tiers: Row[][] = [];
  for (const row of sorted) {
    const tier = tiers[tiers.length - 1];
    if (tier && within(row.amount, median(tier.map((r) => r.amount)), 0.05)) tier.push(row);
    else tiers.push([row]);
  }
  const repeated = tiers.filter((t) => t.length >= 2);
  // One plan (with or without a one-off): as before, so a price change is still noticed.
  if (repeated.length < 2) return [rows];
  const newest = Math.max(...rows.map((r) => r.day));
  for (const tier of tiers) {
    if (tier.length >= 2) continue;
    // The newest payment at a new amount is a price change of the nearest plan, not a one-off.
    const [lone] = tier;
    if (lone.day !== newest) continue;
    const nearest = repeated.reduce((best, t) => (Math.abs(t[0].amount - lone.amount) < Math.abs(best[0].amount - lone.amount) ? t : best));
    nearest.push(lone);
    nearest.sort((x, y) => x.day - y.day);
  }
  // One tier ending and another starting about a month later is one plan at a new price: joined back together.
  const byStart = repeated.map((t) => t.slice().sort((x, y) => x.day - y.day)).sort((a, b) => a[0].day - b[0].day);
  const joined: Row[][] = [];
  for (const tier of byStart) {
    const prev = joined[joined.length - 1];
    const gap = prev ? tier[0].day - prev[prev.length - 1].day : 0;
    if (prev && gap >= BANDS.monthly[0] - 5 && gap <= BANDS.monthly[1] * 1.5) prev.push(...tier);
    else joined.push(tier);
  }
  return joined.sort((a, b) => b.length - a.length || b[0].amount - a[0].amount);
}

/** The key a regular payment's entries answer to (a "#2" tier shares its payee's key). */
export const baseKey = (key: string) => key.split("#")[0];

function kindOf(t: Transaction, direction: "in" | "out"): RegularKind {
  if (t.userCategory === OWN_TRANSFER) return "own";
  if (direction === "in") return "income";
  const type = spendType(t);
  if (type === "EMI & pay later" || isPayLater(t.name)) return "emi";
  if (type === "Rent") return "rent";
  if (type === "Subscriptions") return "subscription";
  if (type === "Bills & recharges") return "bill";
  if (type === "Investments") return "saving";
  return "other";
}

/** Which regular payment an entry would belong to: direction and payee (null when it has no payee). */
export function regularKeyOf(tx: Pick<Transaction, "type" | "amount" | "name" | "shownName">): string | null {
  const direction = tx.type === "debit" || Number(tx.amount) < 0 ? "out" : "in";
  const who = tx.shownName?.toLowerCase() || payeeKey(tx.name);
  return who ? `${direction}|${who}` : null;
}

/** Regular payments in one account's entries, the soonest expected first. */
export function findRegular(transactions: Transaction[] = [], today = new Date()): Regular[] {
  const groups = new Map<string, { direction: "in" | "out"; rows: Row[] }>();
  let lastCovered = -Infinity;

  for (const tx of transactions) {
    const date = String(tx.date ?? "");
    const day = dayOf(date);
    const amount = Math.abs(Number(tx.amount) || 0);
    if (!Number.isFinite(day) || !amount) continue;
    lastCovered = Math.max(lastCovered, day);
    const key = regularKeyOf(tx);
    if (!key) continue;
    const direction = key.startsWith("out|") ? "out" : "in";
    // A telecom payee is paid for two different things: prepaid recharges
    // (whole rupees) and wifi or postpaid bills (GST on top, so paise). Each
    // is its own series, or the bill's rhythm drowns in the recharges.
    const groupKey = direction === "out" && isTelecom(tx.name) && looksLikeBill(amount) ? `${key}#bill` : key;
    const group = groups.get(groupKey) ?? { direction, rows: [] };
    group.rows.push({ tx, day, amount });
    groups.set(groupKey, group);
  }

  // A subscription merchant's payments, split by amount tier (see splitByAmount).
  const tiered: [string, { direction: "in" | "out"; rows: Row[] }][] = [];
  for (const [key, { direction, rows }] of groups) {
    if (direction === "out" && rows.length >= 2 && kindOf(rows[0].tx, direction) === "subscription") {
      splitByAmount(rows).forEach((tier, i) => tiered.push([i === 0 ? key : `${key}#${i + 1}`, { direction, rows: tier }]));
    } else tiered.push([key, { direction, rows }]);
  }

  const todayDay = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY);
  const found: Regular[] = [];

  for (const [key, { direction, rows }] of tiered) {
    // Seen once: only worth showing when it is a known subscription service
    // (statements often cover a single month). Its cadence is a guess: monthly.
    const knownSubscription =
      direction === "out" && rows.length === 1 && spendType(rows[0].tx) === "Subscriptions" && !isStore(payeeKey(rows[0].tx.name) ?? "");
    // The same for a wifi or postpaid bill: telecom bills come every month.
    const telecomBill = key.endsWith("#bill");
    if (rows.length < 2 && !knownSubscription && !telecomBill) continue;
    rows.sort((a, b) => a.day - b.day);
    const gaps = rows.slice(1).map((r, i) => r.day - rows[i].day);
    if (gaps.some((g) => g === 0)) continue; // two on one day: shopping, not a bill

    let cadence: Cadence | null;
    let confidence: Regular["confidence"];
    const amounts = rows.map((r) => r.amount);
    if (rows.length === 1) {
      cadence = "monthly";
      confidence = "low";
    } else if (rows.length === 2) {
      // Twice is enough only for a month apart and the same amount.
      const [lo, hi] = BANDS.monthly;
      if (gaps[0] < lo || gaps[0] > hi || !within(amounts[1], amounts[0], 0.02)) continue;
      cadence = "monthly";
      confidence = "low";
    } else {
      cadence = cadenceOf(gaps);
      if (!cadence) continue;
      confidence = "high";
    }

    // A steady amount, or a steady amount that just changed.
    const lastAmount = amounts[amounts.length - 1];
    // Two steady runs at different amounts (the first at least two long): the price changed where they meet.
    let splitAt = -1;
    for (let k = amounts.length - 1; k >= 2 && splitAt < 0; k--) {
      const first = amounts.slice(0, k);
      const rest = amounts.slice(k);
      const a = median(first);
      const b = median(rest);
      if (!within(b, a, 0.05) && first.every((x) => within(x, a, 0.05)) && rest.every((x) => within(x, b, 0.05))) splitAt = k;
    }
    const changed = splitAt > 0 ? { from: round2(median(amounts.slice(0, splitAt))), to: round2(median(amounts.slice(splitAt))) } : undefined;
    const usual = changed ? median(amounts.slice(splitAt)) : median(amounts);
    const fixedAmount = changed ? true : amounts.every((a) => within(a, usual, 0.05));

    const last = rows[rows.length - 1];
    const lastDate = iso(last.day);
    let next = nextAfter(lastDate, cadence);
    const firstExpected = next;
    // Expected inside what the statements cover (with some slack) but not there: missed.
    // Step forward to the first one the statements cannot show yet.
    let periodsMissed = 0;
    while (dayOf(next) + GRACE[cadence] <= lastCovered) {
      next = nextAfter(next, cadence);
      periodsMissed++;
    }
    // Not missed, and due today or later: upcoming. Due already, but the statements end
    // before it (or only just after): we cannot see it yet.
    const status: RegularStatus = periodsMissed >= 3 ? "stopped" : periodsMissed > 0 ? "missed" : dayOf(next) >= todayDay ? "upcoming" : "unseen";

    const sample = last.tx;
    found.push({
      key,
      name: sample.shownName || payeeName(sample.name),
      kind: kindOf(sample, direction),
      ...(telecomBill ? { variant: "wifiOrPostpaid" as const } : {}),
      direction,
      cadence,
      amount: round2(usual),
      fixedAmount,
      perMonth: round2(usual * PER_MONTH[cadence]),
      count: rows.length,
      confidence,
      last: { date: lastDate, amount: round2(lastAmount) },
      next,
      status,
      ...(periodsMissed > 0 ? { missedSince: firstExpected } : {}),
      ...(changed ? { changed } : {}),
      seen: rows
        .slice()
        .reverse()
        .slice(0, 12)
        .map((r) => ({ id: r.tx.id, date: iso(r.day), amount: round2(r.amount) })),
    });
  }

  return found.sort((a, b) => a.next.localeCompare(b.next));
}
