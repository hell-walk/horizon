import { describe, expect, it } from "vitest";

import { findOverlap, type OverlapRow } from "@/lib/statements/overlap";
import { transactionHash, transactionHashes } from "@/lib/statements/parse";

let n = 0;
const row = (date: string, name: string, amount: number, extra: Partial<OverlapRow> = {}): OverlapRow => ({
  date,
  name,
  amount,
  type: amount < 0 ? "debit" : "credit",
  hash: `h${++n}`,
  ...extra,
});

describe("findOverlap", () => {
  it("puts word-for-word repeats in exact, as before", () => {
    const saved = [row("2026-03-01", "UPI/ZOMATO", -450, { hash: "same" })];
    expect(findOverlap([row("2026-03-01", "UPI/ZOMATO", -450, { hash: "same" })], saved)).toEqual({ exact: [0], likely: [] });
  });

  it("finds the same payment worded differently in another file", () => {
    const saved = [row("2026-03-01", "UPI/DR/531/ZOMATO/SBIN", -450)];
    const incoming = [row("2026-03-01", "Zomato order", -450), row("2026-03-02", "Swiggy", -300)];
    expect(findOverlap(incoming, saved)).toEqual({ exact: [], likely: [{ index: 0, saved: { date: "2026-03-01", name: "UPI/DR/531/ZOMATO/SBIN" } }] });
  });

  it("needs the same direction and amount", () => {
    const saved = [row("2026-03-01", "Refund", 450), row("2026-03-01", "Zomato", -451)];
    expect(findOverlap([row("2026-03-01", "Zomato order", -450)], saved).likely).toEqual([]);
  });

  it("accepts one day apart (posting date versus transaction date), but prefers the same day", () => {
    const saved = [row("2026-03-02", "NEFT SALARY", 50000)];
    expect(findOverlap([row("2026-03-01", "Salary credit", 50000), row("2026-03-03", "x", 1)], saved).likely).toHaveLength(1);

    // Two ₹30 metro rides on consecutive days: each pairs with its own day, not crosswise.
    const rides = [row("2026-03-05", "METRO A", -30), row("2026-03-06", "METRO B", -30)];
    const found = findOverlap([row("2026-03-05", "Metro card", -30), row("2026-03-06", "Metro card", -30)], rides).likely;
    expect(found.map((l) => l.saved.name)).toEqual(["METRO A", "METRO B"]);
  });

  it("ignores saved entries outside the new file's dates", () => {
    // The old file ends on the 15th, the new one starts on the 16th: a ₹30 ride on each day is two rides.
    const saved = [row("2026-03-15", "METRO", -30)];
    expect(findOverlap([row("2026-03-16", "Metro card", -30), row("2026-03-31", "x", -1)], saved).likely).toEqual([]);
  });

  it("uses the running balance when both rows have one", () => {
    const saved = [row("2026-03-01", "TEA STALL", -20, { balance: 980 })];
    expect(findOverlap([row("2026-03-01", "Tea", -20, { balance: 960 })], saved).likely).toEqual([]);
    expect(findOverlap([row("2026-03-01", "Tea", -20, { balance: 980 })], saved).likely).toHaveLength(1);
    expect(findOverlap([row("2026-03-01", "Tea", -20, { balance: null })], saved).likely).toHaveLength(1);
  });

  it("pairs each saved entry with one new entry at most", () => {
    // One tea saved before; the new file has two teas that day: only one can be the saved one.
    const saved = [row("2026-03-01", "TEA STALL", -20)];
    const incoming = [row("2026-03-01", "Tea", -20), row("2026-03-01", "Tea", -20)];
    expect(findOverlap(incoming, saved).likely.map((l) => l.index)).toEqual([0]);
  });

  it("does not offer a saved entry this file already contains word for word", () => {
    const saved = [row("2026-03-01", "ZOMATO", -450, { hash: "z" })];
    const incoming = [row("2026-03-01", "ZOMATO", -450, { hash: "z" }), row("2026-03-01", "Zomato order", -450)];
    expect(findOverlap(incoming, saved)).toEqual({ exact: [0], likely: [] });
  });

  it("finds nothing for a new account", () => {
    expect(findOverlap([row("2026-03-01", "x", -1)], [])).toEqual({ exact: [], likely: [] });
  });
});

describe("transactionHashes", () => {
  const tea = { date: "2026-03-01", name: "TEA STALL", amount: 20, type: "debit" as const };

  it("tells two identical rows apart instead of dropping the second", () => {
    const [a, b] = transactionHashes("bank", [tea, { ...tea }]);
    expect(a).not.toBe(b);
  });

  it("keeps the old fingerprint for the first, so rows saved before still match", () => {
    expect(transactionHashes("bank", [tea, { ...tea }])[0]).toBe(transactionHash("bank", tea));
  });

  it("is the same every time the same file is read", () => {
    expect(transactionHashes("bank", [tea, tea, tea])).toEqual(transactionHashes("bank", [tea, tea, tea]));
  });
});
