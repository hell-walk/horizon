import { describe, expect, it } from "vitest";

import { coverageOf, type GapRow } from "@/lib/statements/gaps";

const row = (date: string, amount: number, balance?: number, type = "debit"): GapRow => ({ date, amount, type, balance });

describe("coverageOf: what the saved entries cover, and the holes in them", () => {
  it("spans first to last entry and finds no hole in a steady run", () => {
    const rows = [row("2026-07-01", 100, 900), row("2026-07-05", 50, 850), row("2026-07-12", 20, 830), row("2026-07-20", 10, 820)];
    expect(coverageOf(rows)).toEqual({ from: "2026-07-01", to: "2026-07-20", count: 4, holes: [] });
  });

  it("reports silence longer than ten days as a possible hole", () => {
    const rows = [row("2026-07-01", 100), row("2026-07-05", 50), row("2026-08-02", 20), row("2026-08-04", 10)];
    expect(coverageOf(rows)!.holes).toEqual([{ from: "2026-07-05", to: "2026-08-02", days: 28, reason: "dates" }]);
  });

  it("silence inside one upload is not a hole: the statement covered those days; between two uploads it may be", () => {
    const upload = (r: GapRow, batch: number) => ({ ...r, batch });
    const quietMonth = [upload(row("2026-07-01", 100), 1), upload(row("2026-07-25", 50), 1), upload(row("2026-08-02", 20), 1)];
    expect(coverageOf(quietMonth)!.holes).toEqual([]);
    const twoFiles = [upload(row("2026-07-01", 100), 1), upload(row("2026-07-05", 50), 1), upload(row("2026-08-02", 20), 2), upload(row("2026-08-04", 10), 2)];
    expect(coverageOf(twoFiles)!.holes).toEqual([{ from: "2026-07-05", to: "2026-08-02", days: 28, reason: "dates" }]);
  });

  it("reports balances that do not join between one day and the next", () => {
    // 850 on the 5th, then a 20 debit on the 12th should leave 830: 500 means entries are missing between.
    const rows = [row("2026-07-01", 100, 900), row("2026-07-05", 50, 850), row("2026-07-12", 20, 500)];
    expect(coverageOf(rows)!.holes).toEqual([{ from: "2026-07-05", to: "2026-07-12", days: 7, reason: "balance" }]);
  });

  it("stays quiet about days with several entries, whose order is unknown", () => {
    const rows = [row("2026-07-05", 50, 850), row("2026-07-05", 30, 820), row("2026-07-12", 20, 500)];
    expect(coverageOf(rows)!.holes).toEqual([]);
  });

  it("says nothing about the time after the last entry", () => {
    const rows = [row("2025-01-01", 100), row("2025-01-03", 50)];
    expect(coverageOf(rows)!.holes).toEqual([]);
  });

  it("has nothing to say without entries or dates", () => {
    expect(coverageOf([])).toBeNull();
    expect(coverageOf([row("not a date", 1)])).toBeNull();
  });
});
