import { describe, expect, it } from "vitest";

import { applyFixes, findDoubtful, readFixes } from "@/lib/statements/doubtful";
import { checkBalances, type ParsedTransaction } from "@/lib/statements/parse";

const TODAY = new Date("2026-10-10T12:00:00Z");
const row = (date: string, name: string, amount: number, type: "debit" | "credit", balance?: number): ParsedTransaction => ({ date, name, amount, type, balance });

describe("findDoubtful", () => {
  it("finds nothing in a clean statement", () => {
    const clean = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-09-02", "Swiggy", 400, "debit", 49600), row("2026-09-03", "Rent", 15000, "debit", 34600)];
    expect(findDoubtful(clean, TODAY)).toEqual([]);
  });

  it("flags a balance break and, when money in and out were read the wrong way, offers to flip it", () => {
    const rows = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-09-02", "Refund", 400, "debit", 50400)];
    expect(findDoubtful(rows, TODAY)).toEqual([{ index: 1, reasons: ["balance"], suggestion: { type: "credit" }, expected: 49600, actual: 50400 }]);
  });

  it("offers the amount the balance moved by when the amount was misread", () => {
    const rows = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-09-02", "Swiggy", 4000, "debit", 49600)];
    expect(findDoubtful(rows, TODAY)[0]).toMatchObject({ reasons: ["balance"], suggestion: { amount: 400 } });
  });

  it("offers no fix when no single change explains the break (a row is probably missing)", () => {
    const rows = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-09-02", "Swiggy", 400, "debit", 51000)];
    expect(findDoubtful(rows, TODAY)[0].suggestion).toBeUndefined();
  });

  it("flags a future date and offers day and month swapped when that is a real past date", () => {
    const rows = [row("2026-09-01", "A", 1, "debit"), row("2026-12-09", "B", 1, "debit")];
    expect(findDoubtful(rows, TODAY)).toEqual([{ index: 1, reasons: ["future"], suggestion: { date: "2026-09-12" } }]);
    // 2026-11-25 swapped would be month 25: no suggestion.
    expect(findDoubtful([row("2026-11-25", "C", 1, "debit")], TODAY)[0].suggestion).toBeUndefined();
  });

  it("allows today and tomorrow (time zones)", () => {
    expect(findDoubtful([row("2026-10-11", "A", 1, "debit")], TODAY)).toEqual([]);
  });

  it("flags a date far from the rest of the statement", () => {
    const rows = [row("2026-09-01", "A", 1, "debit"), row("2026-09-02", "B", 1, "debit"), row("2024-09-03", "C", 1, "debit")];
    expect(findDoubtful(rows, TODAY).map((d) => [d.index, d.reasons])).toEqual([[2, ["farDate"]]]);
  });

  it("flags an amount far bigger than everything else, but not in a small or uniform file", () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => row("2026-09-01", `Tea ${i}`, 20 + i, "debit")), row("2026-09-02", "Ref", 50200341, "debit")];
    expect(findDoubtful(rows, TODAY).map((d) => [d.index, d.reasons])).toEqual([[8, ["bigAmount"]]]);
    expect(findDoubtful([row("2026-09-01", "Car", 900000, "debit"), row("2026-09-02", "Tea", 20, "debit")], TODAY)).toEqual([]);
  });

  it("flags a row with no description and keeps every reason a row has", () => {
    const rows = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-12-09", "1234 / 5678", 400, "debit", 51000)];
    expect(findDoubtful(rows, TODAY)[0].reasons.sort()).toEqual(["balance", "future", "noName"]);
  });
});

describe("readFixes", () => {
  const flagged = new Set([1, 4]);

  it("accepts fixes for flagged rows", () => {
    expect(readFixes(JSON.stringify({ 1: { type: "credit" }, 4: { skip: true } }), flagged)).toEqual({ 1: { type: "credit" }, 4: { skip: true } });
    expect(readFixes(JSON.stringify({ 1: { date: "2026-09-12", amount: 400.456 } }), flagged)).toEqual({ 1: { date: "2026-09-12", amount: 400.46 } });
    expect(readFixes(null, flagged)).toEqual({});
    expect(readFixes("", flagged)).toEqual({});
  });

  it("refuses the whole set if any part is wrong", () => {
    for (const bad of [
      { 2: { skip: true } }, // not a flagged row
      { 1: { amount: -5 } },
      { 1: { amount: "400" } },
      { 1: { amount: 1e13 } },
      { 1: { date: "2026-02-30" } },
      { 1: { date: "12/09/2026" } },
      { 1: { type: "sideways" } },
      { 1: { skip: "yes" } },
      { "1.5": { skip: true } },
      [1, 2],
    ]) {
      expect(readFixes(JSON.stringify(bad), flagged), JSON.stringify(bad)).toBeNull();
    }
    expect(readFixes("{not json", flagged)).toBeNull();
  });
});

describe("applyFixes", () => {
  const rows = [row("2026-09-01", "SALARY", 50000, "credit", 50000), row("2026-09-02", "Refund", 400, "debit", 50400), row("2026-09-03", "x", 1, "debit", 50399)];
  const flagged = new Set([1, 2]);

  it("changes and skips rows as asked, and a flipped direction mends the balance check", () => {
    const fixed = applyFixes(rows, flagged, { 1: { type: "credit" } });
    expect(fixed).toMatchObject({ skipped: 0, changed: 1 });
    expect(checkBalances(fixed.transactions).status).toBe("ok");
    expect(applyFixes(rows, flagged, { 2: { skip: true } })).toMatchObject({ skipped: 1, changed: 0 });
  });

  it("skipping every flagged row leaves out the untouched ones only, and keeps rows marked keep", () => {
    const all = applyFixes(rows, flagged, {}, true);
    expect(all.transactions.map((t) => t.name)).toEqual(["SALARY"]);
    const some = applyFixes(rows, flagged, { 1: { type: "credit" }, 2: { skip: false } }, true);
    expect(some.transactions.map((t) => t.name)).toEqual(["SALARY", "Refund", "x"]);
  });
});
