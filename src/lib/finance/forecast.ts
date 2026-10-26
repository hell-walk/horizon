import { OWN_TRANSFER } from "./corrections";
import { addMonths, baseKey, regularKeyOf, type Regular } from "./recurring";

// "Will I have enough money?" for one account over the next weeks. Plain and
// explainable rather than clever:
//   1. Start from the balance on the day it is known (for uploaded statements,
//      the day the last statement ends, not today).
//   2. Take off everyday spending each day: the average over the last 90 days,
//      leaving out regular payments (they come next), moves between the user's
//      own accounts and big one-off payments.
//   3. Add the regular payments and regular income on their expected dates.
// Money that comes in irregularly is not counted, so the estimate errs on the
// careful side. Everything the screen says about "how we worked this out"
// comes from the numbers returned here.
//
// Three views. "rolling": the next `days` days from today, for anyone.
// "month": the calendar month, for freelancers. "payday": pay day to pay day,
// for salaried people. The last two draw what has already happened since the
// period began, then the estimate to its end (or to the end of the period
// after, when this one has less than a week left).

/** `confidence`: "high" is a rhythm seen three or more times; "low" is seen twice so far (lib/finance/recurring). */
export type ForecastEvent = { date: string; name: string; amount: number; kind: Regular["kind"]; confidence: Regular["confidence"] };
export type ForecastView = "rolling" | "month" | "payday";

export type Forecast =
  | {
      ok: true;
      view: ForecastView;
      /** Month and pay-day views: the balance at the end of each day from the period's start up to the day before `start` (what has already happened). */
      history: { date: string; balance: number }[];
      start: { date: string; balance: number };
      end: { date: string; balance: number };
      lowest: { date: string; balance: number };
      /** The first day the balance is expected to go below zero, if it does. */
      belowZero?: string;
      dailySpend: number;
      /** How many days of everyday spending the average comes from. */
      historyDays: number;
      /** Big one-off payments left out of the average. */
      leftOut: number;
      /** Regular payments and income from the start to the end, signed (money out is negative). */
      events: ForecastEvent[];
      /** The expected balance at the end of every day. */
      points: { date: string; balance: number }[];
    }
  | { ok: false; reason: "noHistory" | "oldStatements"; lastDate?: string };

const DAY = 86_400_000;
const WINDOW = 90; // days of history for the everyday average
const MIN_HISTORY = 21; // fewer days than this is too little to average
const MAX_GAP = 45; // statements ending longer ago than this are too old to project from

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Money in positive, money out negative, going by the entry's type when it has one. */
const signedAmount = (t: Transaction) => {
  const amount = Math.abs(Number(t.amount) || 0);
  return t.type === "debit" ? -amount : t.type === "credit" ? amount : Number(t.amount) || 0;
};
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const step = (date: string, cadence: Regular["cadence"]) =>
  cadence === "weekly" ? iso(dayOf(date) + 7) : addMonths(date, cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12);

export function forecast({
  balance,
  balanceDate,
  transactions,
  regulars,
  today = new Date(),
  days = 30,
  view = "rolling",
  payDay = 1,
}: {
  balance: number;
  /** The day the balance is known for; for imported statements, the last entry's date. */
  balanceDate?: string;
  transactions: Transaction[];
  regulars: Regular[];
  today?: Date;
  days?: number;
  view?: ForecastView;
  /** Pay-day view: the day of the month the salary arrives (31 means the month's last day). */
  payDay?: number;
}): Forecast {
  const todayDay = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY);
  const dated = transactions.filter((t) => Number.isFinite(dayOf(String(t.date ?? ""))));
  if (dated.length === 0) return { ok: false, reason: "noHistory" };

  const lastDay = Math.max(...dated.map((t) => dayOf(t.date)));
  const firstDay = Math.min(...dated.map((t) => dayOf(t.date)));
  const startDay = balanceDate ? Math.min(dayOf(balanceDate), todayDay) : todayDay;
  if (todayDay - startDay > MAX_GAP) return { ok: false, reason: "oldStatements", lastDate: iso(lastDay) };

  // Everyday spending: what is not regular, not own-account, not a big one-off.
  const windowStart = Math.max(firstDay, lastDay - WINDOW + 1);
  const historyDays = lastDay - windowStart + 1;
  if (historyDays < MIN_HISTORY) return { ok: false, reason: "noHistory", lastDate: iso(lastDay) };
  const regularKeys = new Set(regulars.filter((r) => r.status !== "stopped").map((r) => baseKey(r.key)));
  const everyday = dated
    .filter((t) => dayOf(t.date) >= windowStart && (t.type === "debit" || Number(t.amount) < 0))
    .filter((t) => t.userCategory !== OWN_TRANSFER && !regularKeys.has(regularKeyOf(t) ?? ""))
    .map((t) => Math.abs(Number(t.amount) || 0))
    .filter((a) => a > 0)
    .sort((a, b) => a - b);
  // Big one-offs: above the 95th percentile, when there are enough to tell.
  const cut = everyday.length >= 20 ? everyday[Math.floor(everyday.length * 0.95)] : Infinity;
  const kept = everyday.filter((a) => a <= cut);
  const dailySpend = round2(kept.reduce((s, a) => s + a, 0) / historyDays);

  // Where the picture ends and, for a period, where it begins (never before the first entry).
  let endDay = todayDay + days;
  let fromDay = startDay;
  if (view !== "rolling") {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth();
    const onPayDay = Math.min(31, Math.max(1, Math.round(payDay) || 1));
    const lastOf = (m: number) => Math.floor(Date.UTC(year, m + 1, 0) / DAY);
    // The period starting in month m: the 1st, or the pay day (clamped to a short month's last day).
    const startOf = (m: number) =>
      view === "payday" ? Math.min(lastOf(m), Math.floor(Date.UTC(year, m, onPayDay) / DAY)) : Math.floor(Date.UTC(year, m, 1) / DAY);
    const endOf = (m: number) => (view === "payday" ? startOf(m + 1) : lastOf(m));
    const begin = startOf(month) <= todayDay ? month : month - 1;
    // Less than a week of the period left: the next one is shown too.
    endDay = endOf(begin) - todayDay < 7 ? endOf(begin + 1) : endOf(begin);
    fromDay = Math.max(startOf(begin), firstDay);
  }

  // The period so far: walking back from the known balance, each day undoes the entries after it.
  const history: { date: string; balance: number }[] = [];
  if (fromDay < startDay) {
    const netByDay = new Map<number, number>();
    for (const t of dated) {
      const d = dayOf(t.date);
      if (d > fromDay && d <= startDay) netByDay.set(d, (netByDay.get(d) ?? 0) + signedAmount(t));
    }
    let back = balance;
    for (let d = startDay - 1; d >= fromDay; d--) {
      back -= netByDay.get(d + 1) ?? 0;
      history.unshift({ date: iso(d), balance: round2(back) });
    }
  }

  // Regular payments and income from the start to the end, each repeat on its date.
  const events: ForecastEvent[] = [];
  for (const r of regulars) {
    if (r.status === "stopped" || r.status === "missed") continue;
    for (let date = r.next; dayOf(date) <= endDay; date = step(date, r.cadence)) {
      // Expected just before the start but not in the statements yet: still to come, so on the first day.
      const on = dayOf(date) > startDay ? date : iso(startDay + 1);
      events.push({ date: on, name: r.name, amount: r.direction === "out" ? -r.amount : r.amount, kind: r.kind, confidence: r.confidence });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const byDay = new Map<number, number>();
  for (const e of events) byDay.set(dayOf(e.date), (byDay.get(dayOf(e.date)) ?? 0) + e.amount);

  const points: { date: string; balance: number }[] = [];
  let running = balance;
  let lowest = { date: iso(startDay), balance: round2(balance) };
  let belowZero: string | undefined;
  for (let d = startDay + 1; d <= endDay; d++) {
    running += (byDay.get(d) ?? 0) - dailySpend;
    const point = { date: iso(d), balance: round2(running) };
    points.push(point);
    if (point.balance < lowest.balance) lowest = point;
    if (!belowZero && point.balance < 0) belowZero = point.date;
  }

  return {
    ok: true,
    view,
    history,
    start: { date: iso(startDay), balance: round2(balance) },
    end: points[points.length - 1] ?? { date: iso(startDay), balance: round2(balance) },
    lowest,
    ...(belowZero ? { belowZero } : {}),
    dailySpend,
    historyDays,
    leftOut: everyday.length - kept.length,
    events,
    points,
  };
}
