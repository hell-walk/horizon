import { describe, expect, it } from "vitest";

import { spendingDetail, spendSlug } from "@/lib/spendingDetail";

const debit = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount: -amount, type: "debit" }) as Transaction;
const credit = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount, type: "credit" }) as Transaction;

const tx = [
  credit("s1", "2026-07-01", "SALARY", 60000),
  debit("a", "2026-07-04", "UPI/DR/1/SWIGGY/YESB/swiggy@ybl/", 400), // Sat
  debit("b", "2026-07-11", "UPI/DR/2/ZOMATO/YESB/zomato@ybl/", 600), // Sat
  debit("c", "2026-08-08", "UPI/DR/3/SWIGGY/YESB/swiggy@ybl/", 500),
  debit("d", "2026-09-05", "UPI/DR/4/SWIGGY/YESB/swiggy@ybl/", 1500),
  debit("e", "2026-09-06", "UPI/DR/5/RAHUL SHARMA/YESB/rahul@ybl/", 2000),
  debit("f", "2026-09-07", "UPI/DR/6/SHARMA ENTERPRISES/YESB/se@ybl/", 300),
  debit("own", "2026-09-08", "IMPS SELF", 5000),
];
tx[7] = { ...tx[7], userCategory: "Between my accounts" } as Transaction;

describe("one kind of spending, closely", () => {
  it("slugs bucket names for the address bar", () => {
    expect(spendSlug("UPI payments")).toBe("upi-payments");
    expect(spendSlug("EMI & pay later")).toBe("emi-pay-later");
    expect(spendSlug("Cash (ATM)")).toBe("cash-atm");
  });

  it("adds up the bucket, its payees, months and weekdays", () => {
    const food = spendingDetail(tx, "food")!;
    expect(food).toMatchObject({ name: "Food", total: 3000, count: 4, average: 750, from: "2026-07-04", to: "2026-09-08" });
    expect(food.share).toBeCloseTo(3000 / 5300); // own transfers are not spending
    expect(food.payees.map((p) => [p.name, p.amount])).toEqual([
      ["Swiggy", 2400],
      ["Zomato", 600],
    ]);
    expect(food.months.slice(-3)).toEqual([
      { month: "2026-07", amount: 1000, count: 2 },
      { month: "2026-08", amount: 500, count: 1 },
      { month: "2026-09", amount: 1500, count: 1 },
    ]);
    // The statements end on 8 Sept: a third of a month is not compared with usual.
    expect(food.compare).toBeNull();
    const fullSept = spendingDetail([...tx, debit("late", "2026-09-28", "ATM CASH WDL", 1000)], "food")!;
    expect(fullSept.compare).toEqual({ month: "2026-09", amount: 1500, usual: 750, difference: 750 });
    expect(food.weekdays[5]).toBe(3000); // all four fell on Saturdays
    expect(food.biggest[0].amount).toBe(1500);
  });

  it("splits UPI into people and shops", () => {
    const upi = spendingDetail(tx, "upi-payments")!;
    expect(upi.upi).toEqual({ people: { amount: 2000, count: 1 }, shops: { amount: 300, count: 1 } });
  });

  it("knows no bucket by an unknown name", () => {
    expect(spendingDetail(tx, "no-such-thing")).toBeNull();
    expect(spendingDetail([], "food")).toBeNull();
  });
});
