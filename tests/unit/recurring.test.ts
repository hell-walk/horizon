import { describe, expect, it } from "vitest";

import { addMonths, findRegular } from "@/lib/recurring";

const TODAY = new Date("2026-10-10T12:00:00Z");
let n = 0;
const tx = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `t${++n}`, date, name, amount: Math.abs(amount), type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

// Monthly on the given day, for the given months of 2026.
const monthly = (name: string, amount: number, day: number, months: number[], extra: Partial<Transaction> = {}) =>
  months.map((m) => tx(`2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name, amount, extra));

describe("addMonths", () => {
  it("keeps the day, or uses the month's last day", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("findRegular", () => {
  it("finds rent paid every month, with when it is due next", () => {
    const [rent] = findRegular(monthly("UPI/DR/1/RAHUL SHARMA/RENT", -15000, 5, [6, 7, 8, 9, 10]), TODAY);
    expect(rent).toMatchObject({
      kind: "rent",
      direction: "out",
      cadence: "monthly",
      amount: 15000,
      fixedAmount: true,
      perMonth: 15000,
      count: 5,
      confidence: "high",
      last: { date: "2026-10-05", amount: 15000 },
      next: "2026-11-05",
      status: "upcoming",
    });
    expect(rent.seen.map((s) => s.date)[0]).toBe("2026-10-05"); // the evidence, newest first
  });

  it("finds an EMI, a subscription, a bill and salary, and names their kinds", () => {
    const found = findRegular(
      [
        ...monthly("NACH/BAJAJ FINANCE EMI", -4500, 3, [7, 8, 9]),
        ...monthly("NETFLIX.COM", -199, 12, [7, 8, 9]),
        ...monthly("BESCOM ELECTRICITY", -1200, 20, [7, 8, 9]).map((t, i) => ({ ...t, amount: [1100, 1450, 990][i] })),
        ...monthly("NEFT CR INFOSYS SALARY", 85000, 1, [7, 8, 9, 10]),
      ],
      TODAY
    );
    const byKind = Object.fromEntries(found.map((r) => [r.kind, r]));
    expect(Object.keys(byKind).sort()).toEqual(["bill", "emi", "income", "subscription"]);
    expect(byKind.bill.fixedAmount).toBe(false); // electricity varies, and is still regular
    expect(byKind.income).toMatchObject({ direction: "in", amount: 85000 });
  });

  it("does not call everyday shopping regular", () => {
    const swiggy = ["2026-09-01", "2026-09-03", "2026-09-04", "2026-09-11", "2026-09-25", "2026-10-02"].map((d) => tx(d, "UPI/SWIGGY", -300));
    expect(findRegular(swiggy, TODAY)).toEqual([]);
    // Two the same day is shopping too.
    expect(findRegular([tx("2026-08-05", "AMAZON", -999), tx("2026-09-05", "AMAZON", -999), tx("2026-09-05", "AMAZON", -999)], TODAY)).toEqual([]);
  });

  it("accepts twice only for a month apart and the same amount, and says so", () => {
    expect(findRegular(monthly("SPOTIFY", -119, 8, [8, 9]), TODAY)[0]).toMatchObject({ confidence: "low", count: 2 });
    expect(findRegular([tx("2026-08-08", "SPOTIFY", -119), tx("2026-09-08", "SPOTIFY", -149)], TODAY)).toEqual([]);
  });

  it("finds weekly and yearly rhythms", () => {
    const weekly = ["2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02"].map((d) => tx(d, "MAID SALARY", -1000));
    expect(findRegular(weekly, TODAY)[0]).toMatchObject({ cadence: "weekly", next: "2026-10-09", perMonth: 4333.33 });
    const yearly = [tx("2024-03-01", "LIC PREMIUM", -24000), tx("2025-03-01", "LIC PREMIUM", -24000), tx("2026-03-02", "LIC PREMIUM", -24000)];
    expect(findRegular(yearly, TODAY)[0]).toMatchObject({ cadence: "yearly", next: "2027-03-02", perMonth: 2000 });
  });

  it("tolerates one month with no payment in between", () => {
    expect(findRegular(monthly("NETFLIX", -199, 12, [5, 6, 8, 9]), TODAY)[0]).toMatchObject({ cadence: "monthly" });
  });

  it("notices when a steady amount changes", () => {
    const netflix = [...monthly("NETFLIX", -199, 12, [6, 7, 8]), tx("2026-09-12", "NETFLIX", -249)];
    expect(findRegular(netflix, TODAY)[0]).toMatchObject({ changed: { from: 199, to: 249 }, amount: 249, fixedAmount: true });
  });

  it("judges 'missed' against where the statements end, not today", () => {
    // Statements end 30 Sep. Rent on the 5th: October's is not in them yet, and today is past it.
    const upToSeptember = [...monthly("RENT", -15000, 5, [6, 7, 8, 9]), tx("2026-09-30", "TEA", -20)];
    expect(findRegular(upToSeptember, TODAY).find((r) => r.kind === "rent")).toMatchObject({ status: "unseen", next: "2026-10-05" });

    // Statements run to 30 Sep but the rent stopped after July: August and September are missing.
    const stoppedEarly = [...monthly("RENT", -15000, 5, [5, 6, 7]), tx("2026-09-30", "TEA", -20)];
    expect(findRegular(stoppedEarly, TODAY).find((r) => r.kind === "rent")).toMatchObject({ status: "missed", missedSince: "2026-08-05" });

    const longGone = [...monthly("GYM", -1500, 5, [1, 2, 3]), tx("2026-09-30", "TEA", -20)];
    expect(findRegular(longGone, TODAY)[0]).toMatchObject({ status: "stopped" });
  });

  it("uses the user's own names, and keeps the same payee in and out apart", () => {
    const named = monthly("UPI/DR/9/R SHARMA", -15000, 5, [7, 8, 9], { shownName: "Landlord" });
    expect(findRegular(named, TODAY)[0].name).toBe("Landlord");
    const both = [...monthly("RAHUL", -500, 2, [7, 8, 9]), ...monthly("RAHUL", 500, 20, [7, 8, 9])];
    expect(findRegular(both, TODAY).map((r) => r.direction).sort()).toEqual(["in", "out"]);
  });

  it("marks money moved between your own accounts", () => {
    const sip = monthly("NEFT TO MY SBI", -5000, 10, [7, 8, 9], { userCategory: "Between my accounts" });
    expect(findRegular(sip, TODAY)[0].kind).toBe("own");
  });

  it("copes with nothing and with junk", () => {
    expect(findRegular()).toEqual([]);
    expect(findRegular([tx("", "X", -1), tx("2026-01-01", "X", 0)], TODAY)).toEqual([]);
  });
});
