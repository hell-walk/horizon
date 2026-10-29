import { describe, expect, it } from "vitest";

import { chainDay, orderRows, type OrderRow } from "@/lib/statements/rowOrder";

let n = 0;
const row = (date: string, type: "debit" | "credit", amount: number, balance: number | null): OrderRow => ({ id: `r${++n}`, date, type, amount, balance });

describe("a day's rows in the bank's order, from the balances", () => {
  it("chains rows from the opening balance whatever order they arrive in", () => {
    const a = row("2026-10-01", "debit", 100, 900);
    const b = row("2026-10-01", "credit", 50, 950);
    const c = row("2026-10-01", "debit", 200, 750);
    const day = chainDay([c, a, b], 1000);
    expect(day.ordered.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect(day).toMatchObject({ close: 750, complete: true });
  });

  it("backtracks past a reversed payment that returns the balance to an earlier value", () => {
    // 1000 -> pay 20000? no: 1000 -> debit 300 (700) -> credit 300 back (1000) -> debit 50 (950)
    const out = row("2026-10-01", "debit", 300, 700);
    const back = row("2026-10-01", "credit", 300, 1000);
    const next = row("2026-10-01", "debit", 50, 950);
    // Listed with the later row first: a greedy walk would take `next` straight away and strand the pair.
    const day = chainDay([next, back, out], 1000);
    expect(day.complete).toBe(true);
    expect(day.ordered.map((r) => r.id)).toEqual([out.id, back.id, next.id]);
  });

  it("orders a whole account day by day and names the days that do not add up", () => {
    const rows = [
      row("2026-10-02", "debit", 10, 740),
      row("2026-10-01", "debit", 200, 750),
      row("2026-10-01", "debit", 100, 900),
      row("2026-10-01", "credit", 50, 950),
      row("2026-10-03", "debit", 5, 700), // 740 - 5 is 735, not 700: a row is missing
    ];
    const { ordered, days, incomplete, breaks } = orderRows(rows);
    expect(days).toBe(3);
    expect(ordered.slice(0, 3).map((r) => r.balance)).toEqual([900, 950, 750]);
    expect(ordered[3].balance).toBe(740);
    // The last day is one row, so its order is known, but it does not follow from 740: a row is missing between.
    expect(incomplete).toEqual([]);
    expect(breaks).toEqual(["2026-10-03"]);
    // Two rows on that day that chain with each other but not from 740: the same break, and still ordered.
    const two = [...rows.slice(0, 4), row("2026-10-03", "debit", 5, 700), row("2026-10-03", "credit", 20, 720)];
    const again = orderRows(two);
    expect(again.breaks).toEqual(["2026-10-03"]);
    expect(again.ordered.slice(-2).map((r) => r.balance)).toEqual([700, 720]);
  });

  it("keeps rows without balances where they are", () => {
    const rows = [row("2026-10-01", "debit", 10, null), row("2026-10-01", "debit", 20, null)];
    const { ordered, incomplete } = orderRows(rows);
    expect(ordered).toEqual(rows);
    expect(incomplete).toEqual(["2026-10-01"]);
  });
});
