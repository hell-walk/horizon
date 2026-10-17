import { describe, expect, it } from "vitest";

import { importGap, reachesLatest } from "@/lib/statements/gaps";

const row = (date: string, amount: number, type: "debit" | "credit", balance?: number) => ({ date, amount, type, balance });

// Saved: August, ending with balance 50,000 on 31 Aug.
const august = [row("2026-08-01", 60000, "credit", 70000), row("2026-08-15", 15000, "debit", 55000), row("2026-08-31", 5000, "debit", 50000)];

describe("missing weeks between statements", () => {
  it("none when the next month follows on, dates and balances joining", () => {
    const september = [row("2026-09-01", 2000, "debit", 48000), row("2026-09-30", 1000, "debit", 47000)];
    expect(importGap(august, september)).toBeNull();
  });

  it("a long silence in dates is a gap", () => {
    const november = [row("2026-11-02", 2000, "debit", 30000), row("2026-11-30", 1000, "debit", 29000)];
    expect(importGap(august, november)).toEqual({ from: "2026-08-31", to: "2026-11-02", days: 63, reason: "dates" });
  });

  it("an older statement with a hole before the saved entries is a gap too", () => {
    const may = [row("2026-05-01", 1000, "debit", 9000), row("2026-05-31", 1000, "debit", 8000)];
    expect(importGap(august, may)).toMatchObject({ from: "2026-05-31", to: "2026-08-01", reason: "dates" });
  });

  it("dates that nearly touch but balances that do not join: entries are missing", () => {
    const september = [row("2026-09-03", 2000, "debit", 38000), row("2026-09-30", 1000, "debit", 37000)];
    expect(importGap(august, september)).toEqual({ from: "2026-08-31", to: "2026-09-03", days: 3, reason: "balance" });
  });

  it("no balance check when either side has no balances, or several entries share the boundary day", () => {
    expect(importGap(august, [row("2026-09-03", 2000, "debit"), row("2026-09-30", 1000, "debit")])).toBeNull();
    const twoOnFirstDay = [row("2026-09-01", 2000, "debit", 38000), row("2026-09-01", 500, "debit", 37500)];
    expect(importGap(august, twoOnFirstDay)).toBeNull();
  });

  it("overlapping statements have no gap; a first import has none either", () => {
    expect(importGap(august, [row("2026-08-20", 100, "debit", 1), row("2026-09-10", 100, "debit", 2)])).toBeNull();
    expect(importGap([], august)).toBeNull();
  });
});

describe("whose closing balance counts", () => {
  it("only a statement reaching as far as the saved entries updates the balance", () => {
    expect(reachesLatest(august, [row("2026-09-30", 1, "debit", 1)])).toBe(true);
    expect(reachesLatest(august, [row("2026-05-31", 1, "debit", 1)])).toBe(false);
    expect(reachesLatest([], august)).toBe(true);
  });
});
