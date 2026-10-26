// The cash-flow calendar: every account's forecast (lib/finance/forecast) laid out
// day by day, together. A day appears when something is expected on it: an
// EMI, rent, a subscription, a bill, the salary. Beside each day, the balance
// each account is expected to have after it, and the total. The lowest point
// of the whole window is the headline, since that is the day money is tight.

import type { Forecast, ForecastEvent } from "./forecast";

export type CalendarAccount = { id: string; name: string; mask: string; currency: string };
export type CalendarEvent = ForecastEvent & { account: CalendarAccount };
export type CalendarDay = {
  date: string;
  events: CalendarEvent[];
  /** Each account's expected balance at the end of this day (accounts with a forecast only). */
  balances: { account: CalendarAccount; balance: number }[];
  /** Every forecast account added up, when they share a currency. */
  total: number | null;
};
export type Calendar = {
  from: string;
  to: string;
  days: CalendarDay[];
  /** Accounts that could not be projected (no balance, too little history, statements too old). */
  without: CalendarAccount[];
  /** The lowest expected total in the window, and the day. */
  lowest: { date: string; total: number } | null;
  /** The first account expected to go below zero, and when. */
  belowZero: { account: CalendarAccount; date: string } | null;
  currency: string | null;
};

type Input = { account: CalendarAccount; forecast: Forecast | { ok: false; reason: string } };

/** Every account's forecast as one calendar. Only days with something expected are listed. */
export function buildCalendar(inputs: Input[]): Calendar {
  const projected = inputs.filter((i): i is { account: CalendarAccount; forecast: Extract<Forecast, { ok: true }> } => i.forecast.ok);
  const without = inputs.filter((i) => !i.forecast.ok).map((i) => i.account);
  if (projected.length === 0) return { from: "", to: "", days: [], without, lowest: null, belowZero: null, currency: null };

  const currencies = new Set(projected.map((p) => p.account.currency));
  const currency = currencies.size === 1 ? projected[0].account.currency : null;
  const from = projected.map((p) => p.forecast.start.date).sort()[0];
  const to = projected
    .map((p) => p.forecast.end.date)
    .sort()
    .at(-1)!;

  // Each account's balance by day, so any day can be looked up.
  const byDay = projected.map((p) => ({
    account: p.account,
    points: new Map(p.forecast.points.map((pt) => [pt.date, pt.balance])),
    last: p.forecast.start.balance,
  }));
  const balanceOn = (entry: (typeof byDay)[number], date: string) => {
    // The latest point on or before the day: an account projected from an earlier day has one for every day after.
    const exact = entry.points.get(date);
    if (exact !== undefined) return exact;
    let best: { date: string; balance: number } | null = null;
    for (const [d, balance] of entry.points) if (d <= date && (!best || d > best.date)) best = { date: d, balance };
    return best ? best.balance : entry.last;
  };

  const eventDates = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const p of projected)
    for (const e of p.forecast.events) {
      events.push({ ...e, account: p.account });
      eventDates.add(e.date);
    }
  const days: CalendarDay[] = [...eventDates].sort().map((date) => {
    const balances = byDay.map((entry) => ({ account: entry.account, balance: balanceOn(entry, date) }));
    return {
      date,
      events: events.filter((e) => e.date === date).sort((a, b) => a.amount - b.amount),
      balances,
      total: currency ? Math.round(balances.reduce((s, b) => s + b.balance, 0) * 100) / 100 : null,
    };
  });

  // The lowest total over every projected day, not just the days with events.
  let lowest: Calendar["lowest"] = null;
  if (currency) {
    const allDates = new Set(projected.flatMap((p) => p.forecast.points.map((pt) => pt.date)));
    for (const date of allDates) {
      const total = Math.round(byDay.reduce((s, entry) => s + balanceOn(entry, date), 0) * 100) / 100;
      if (!lowest || total < lowest.total) lowest = { date, total };
    }
  }
  const below = projected.filter((p) => p.forecast.belowZero).sort((a, b) => a.forecast.belowZero!.localeCompare(b.forecast.belowZero!))[0];
  const belowZero = below ? { account: below.account, date: below.forecast.belowZero! } : null;

  return { from, to, days, without, lowest, belowZero, currency };
}
