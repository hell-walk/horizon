import { describe, expect, it } from "vitest";

import { findInsights, latestFullMonth } from "@/lib/insights";

const TODAY = new Date("2026-10-10T12:00:00Z");
let n = 0;
const tx = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `t${++n}`, date, name, amount: Math.abs(amount), type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

/** A steady month: salary, rent, about ₹2,000 on food in four orders. */
const steadyMonth = (m: string, food = [500, 500, 500, 500]) => [
  tx(`2026-${m}-01`, "NEFT CR SALARY ACME", 60000),
  tx(`2026-${m}-05`, "RENT TO LANDLORD", -15000),
  ...food.map((a, i) => tx(`2026-${m}-${String(10 + i * 3).padStart(2, "0")}`, "UPI/SWIGGY", -a)),
  tx(`2026-${m}-28`, "TEA STALL", -20),
];

describe("latestFullMonth", () => {
  it("is the last entry's month when it reaches the month's end and is over", () => {
    expect(latestFullMonth("2026-09-30", TODAY)).toBe("2026-09");
  });
  it("is the month before when the last month is partial or still running", () => {
    expect(latestFullMonth("2026-09-14", TODAY)).toBe("2026-08");
    expect(latestFullMonth("2026-10-08", TODAY)).toBe("2026-09");
    expect(latestFullMonth("2026-01-10", TODAY)).toBe("2025-12");
  });
});

describe("findInsights", () => {
  it("needs a full month and at least two before it", () => {
    expect(findInsights([...steadyMonth("08"), ...steadyMonth("09")], TODAY)).toEqual({ ok: false, reason: "tooLittle" });
    expect(findInsights([], TODAY)).toEqual({ ok: false, reason: "tooLittle" });
  });

  it("says nothing when nothing really changed", () => {
    const result = findInsights([...steadyMonth("06"), ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09", [520, 480, 510, 490])], TODAY);
    expect(result).toEqual({ ok: true, month: "2026-09", insights: [] });
  });

  it("explains food spending going up, with the numbers and the entries", () => {
    const result = findInsights([...steadyMonth("06"), ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09", [900, 800, 700, 800])], TODAY);
    if (!result.ok) throw new Error("expected insights");
    const food = result.insights.find((i) => i.kind === "categoryUp");
    expect(food).toMatchObject({ category: "Food", month: "2026-09", amount: 3200, usual: 2000, difference: 1200, count: 4 });
    if (food?.kind !== "categoryUp") throw new Error("expected categoryUp");
    expect(food.basis).toEqual([
      { month: "2026-06", amount: 2000 },
      { month: "2026-07", amount: 2000 },
      { month: "2026-08", amount: 2000 },
    ]);
    expect(food.entries[0].amount).toBe(900); // biggest first
  });

  it("says why less was kept: spending rose while income stayed the same", () => {
    const result = findInsights(
      [...steadyMonth("06"), ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09"), tx("2026-09-15", "CROMA ELECTRONICS", -12000)],
      TODAY
    );
    if (!result.ok) throw new Error("expected insights");
    const kept = result.insights.find((i) => i.kind === "keptLess");
    expect(kept).toMatchObject({ kept: 60000 - 17020 - 12000, usualKept: 60000 - 17020, difference: -12000, incomeChange: 0, spendingChange: 12000 });
    // The new shop also shows, as a new place taking a real share of the month.
    expect(result.insights.find((i) => i.kind === "newPayee")).toMatchObject({ payee: "Croma Electronics", amount: 12000 });
  });

  it("notices spending going down too", () => {
    const result = findInsights([...steadyMonth("06"), ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09", [200, 200])], TODAY);
    if (!result.ok) throw new Error("expected insights");
    expect(result.insights.find((i) => i.kind === "categoryDown")).toMatchObject({ category: "Food", amount: 400, usual: 2000 });
  });

  it("does not treat a month the statements only partly cover as usual", () => {
    // The statement starts on 3 June, after June's salary: June must not count as a month with no income.
    const june = steadyMonth("06").filter((t) => t.date >= "2026-06-03");
    expect(findInsights([...june, ...steadyMonth("07"), ...steadyMonth("08")], TODAY)).toEqual({ ok: false, reason: "tooLittle" });
    const result = findInsights([...june, ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09")], TODAY);
    expect(result).toEqual({ ok: true, month: "2026-09", insights: [] });
  });

  it("uses the user's categories and leaves out moves between their own accounts", () => {
    const months = [...steadyMonth("06"), ...steadyMonth("07"), ...steadyMonth("08"), ...steadyMonth("09")];
    const own = tx("2026-09-20", "NEFT TO MY SBI", -30000, { userCategory: "Between my accounts" });
    expect(findInsights([...months, own], TODAY)).toEqual({ ok: true, month: "2026-09", insights: [] });
  });
});
