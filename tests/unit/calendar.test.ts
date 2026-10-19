import { describe, expect, it } from "vitest";

import { buildCalendar } from "@/lib/calendar";
import type { Forecast, ForecastEvent } from "@/lib/forecast";

const account = (id: string, currency = "INR") => ({ id, name: `Bank ${id}`, mask: "1234", currency });
const ok = (start: number, points: { date: string; balance: number }[], events: ForecastEvent[], belowZero?: string): Forecast => ({
  ok: true,
  start: { date: "2026-10-01", balance: start },
  end: points.at(-1)!,
  lowest: points.reduce((l, p) => (p.balance < l.balance ? p : l), { date: "2026-10-01", balance: start }),
  ...(belowZero ? { belowZero } : {}),
  dailySpend: 100,
  historyDays: 90,
  leftOut: 0,
  events,
  points,
});

const a = ok(
  10000,
  [
    { date: "2026-10-02", balance: 9900 },
    { date: "2026-10-03", balance: 800 },
    { date: "2026-10-04", balance: 700 },
  ],
  [{ date: "2026-10-03", name: "Home loan EMI", amount: -9000, kind: "emi", confidence: "high" }],
);
const b = ok(
  5000,
  [
    { date: "2026-10-02", balance: 4900 },
    { date: "2026-10-03", balance: 4800 },
    { date: "2026-10-04", balance: 44700 },
  ],
  [{ date: "2026-10-04", name: "Salary", amount: 40000, kind: "income", confidence: "high" }],
);

describe("buildCalendar: every account's forecast, day by day", () => {
  it("lists the days with something expected, with each account's balance and the total after them", () => {
    const cal = buildCalendar([
      { account: account("a"), forecast: a },
      { account: account("b"), forecast: b },
    ]);
    expect(cal.days.map((d) => d.date)).toEqual(["2026-10-03", "2026-10-04"]);
    expect(cal.days[0].events[0]).toMatchObject({ name: "Home loan EMI", amount: -9000, account: { id: "a" } });
    expect(cal.days[0].total).toBe(800 + 4800);
    expect(cal.days[1].total).toBe(700 + 44700);
    expect(cal.lowest).toEqual({ date: "2026-10-03", total: 5600 });
    expect(cal.currency).toBe("INR");
    expect(cal.without).toEqual([]);
  });

  it("names the first account expected to go below zero, and keeps unprojectable accounts aside", () => {
    const short = ok(
      100,
      [{ date: "2026-10-02", balance: -50 }],
      [{ date: "2026-10-02", name: "Rent", amount: -150, kind: "rent", confidence: "low" }],
      "2026-10-02",
    );
    const cal = buildCalendar([
      { account: account("a"), forecast: short },
      { account: account("c"), forecast: { ok: false, reason: "noBalance" } },
    ]);
    expect(cal.belowZero).toEqual({ account: account("a"), date: "2026-10-02" });
    expect(cal.without).toEqual([account("c")]);
  });

  it("gives no total across different currencies", () => {
    const cal = buildCalendar([
      { account: account("a"), forecast: a },
      { account: account("b", "USD"), forecast: b },
    ]);
    expect(cal.currency).toBeNull();
    expect(cal.days[0].total).toBeNull();
    expect(cal.lowest).toBeNull();
  });

  it("is empty with nothing to project", () => {
    expect(buildCalendar([{ account: account("c"), forecast: { ok: false, reason: "noHistory" } }])).toMatchObject({
      days: [],
      lowest: null,
      without: [account("c")],
    });
  });
});
