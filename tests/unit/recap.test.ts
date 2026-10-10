import { describe, expect, it } from "vitest";

import { findRegular } from "@/lib/recurring";
import { weeklyRecap } from "@/lib/recap";

const TODAY = new Date("2026-10-10T12:00:00Z");
let n = 0;
const tx = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `t${++n}`, date, name, amount: Math.abs(amount), type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

/** ₹700 a week of tea (₹100 a day) from 1 Sep to 9 Oct. */
const daily = () => {
  const rows: Transaction[] = [];
  for (let d = Date.UTC(2026, 8, 1); d <= Date.UTC(2026, 9, 9); d += 86_400_000) rows.push(tx(new Date(d).toISOString().slice(0, 10), `TEA ${n}`, -100));
  return rows;
};

describe("weeklyRecap", () => {
  it("adds up the last seven days and compares with a usual week", () => {
    const r = weeklyRecap([...daily(), tx("2026-10-07", "SWIGGY ORDER", -900), tx("2026-10-08", "REFUND AMAZON", 500)], [], TODAY)!;
    expect(r).toMatchObject({ from: "2026-10-03", to: "2026-10-09", past: true, moneyOut: 1600, everydayOut: 1600, moneyIn: 500, usualEveryday: 700 });
    expect(r.biggest[0]).toMatchObject({ name: "Swiggy", amount: 900 });
    expect(r.topCategory).toEqual({ name: "Food", amount: 900 });
  });

  it("ends today when the entries reach today", () => {
    const r = weeklyRecap([...daily(), tx("2026-10-10", "TEA", -100)], [], TODAY)!;
    expect(r).toMatchObject({ to: "2026-10-10", past: false });
  });

  it("does not compare with too little history", () => {
    const r = weeklyRecap([tx("2026-10-05", "A", -100), tx("2026-10-08", "B", -100)], [], TODAY)!;
    expect(r.usualEveryday).toBeUndefined();
    expect(r.weeksCompared).toBe(0);
  });

  it("does not count the rent as extra spending in the week it falls", () => {
    // Rent on the 5th of September and October, inside the period the statements cover.
    const rent = ["2026-09-05", "2026-10-05"].map((d) => tx(d, "RENT TO LANDLORD", -15000));
    const rows = [...daily(), ...rent];
    const r = weeklyRecap(rows, findRegular(rows, TODAY), TODAY)!;
    expect(r).toMatchObject({ moneyOut: 15700, everydayOut: 700, usualEveryday: 700, regularOut: [{ name: "Rent", amount: 15000 }] });
  });

  it("lists regular payments due in the next seven days", () => {
    const netflix = ["2026-07-12", "2026-08-12", "2026-09-12"].map((d) => tx(d, "NETFLIX.COM", -199));
    const rows = [...daily(), ...netflix];
    const r = weeklyRecap(rows, findRegular(rows, TODAY), TODAY)!;
    expect(r.dueNext).toEqual([{ name: "Netflix", date: "2026-10-12", amount: 199 }]);
  });

  it("leaves out moves between your own accounts, and copes with nothing", () => {
    const r = weeklyRecap([...daily(), tx("2026-10-08", "NEFT TO MY SBI", -20000, { userCategory: "Between my accounts" })], [], TODAY)!;
    expect(r.moneyOut).toBe(700);
    expect(weeklyRecap([], [], TODAY)).toBeNull();
  });
});
