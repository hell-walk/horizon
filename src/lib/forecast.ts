import { OWN_TRANSFER } from "./corrections";
import { addMonths, regularKeyOf, type Regular } from "./recurring";

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

export type ForecastEvent = { date: string; name: string; amount: number; kind: Regular["kind"] };

export type Forecast =
  | {
      ok: true;
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
}: {
  balance: number;
  /** The day the balance is known for; for imported statements, the last entry's date. */
  balanceDate?: string;
  transactions: Transaction[];
  regulars: Regular[];
  today?: Date;
  days?: number;
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
  const regularKeys = new Set(regulars.filter((r) => r.status !== "stopped").map((r) => r.key));
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

  // Regular payments and income from the start to the end, each repeat on its date.
  const endDay = todayDay + days;
  const events: ForecastEvent[] = [];
  for (const r of regulars) {
    if (r.status === "stopped" || r.status === "missed") continue;
    for (let date = r.next; dayOf(date) <= endDay; date = step(date, r.cadence)) {
      // Expected just before the start but not in the statements yet: still to come, so on the first day.
      const on = dayOf(date) > startDay ? date : iso(startDay + 1);
      events.push({ date: on, name: r.name, amount: r.direction === "out" ? -r.amount : r.amount, kind: r.kind });
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
