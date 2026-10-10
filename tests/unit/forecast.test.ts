import { describe, expect, it } from "vitest";

import { forecast } from "@/lib/forecast";
import { findRegular } from "@/lib/recurring";

const TODAY = new Date("2026-10-10T12:00:00Z");
let n = 0;
const tx = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `t${++n}`, date, name, amount: Math.abs(amount), type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

/** 90 days (12 Jul to 9 Oct) of ₹100 a day of everyday spending, plus whatever else is passed. */
const history = (...extra: Transaction[]) => {
  const rows: Transaction[] = [];
  for (let d = Date.UTC(2026, 6, 12); d <= Date.UTC(2026, 9, 9); d += 86_400_000) rows.push(tx(new Date(d).toISOString().slice(0, 10), `SHOP ${n}`, -100));
  return [...rows, ...extra];
};
const run = (transactions: Transaction[], balance: number, balanceDate?: string) =>
  forecast({ balance, balanceDate, transactions, regulars: findRegular(transactions, TODAY), today: TODAY });

describe("forecast", () => {
  it("takes off everyday spending each day from the balance", () => {
    const f = run(history(), 10000, "2026-10-09");
    if (!f.ok) throw new Error(f.reason);
    expect(f.dailySpend).toBe(100);
    expect(f.historyDays).toBe(90);
    expect(f.start).toEqual({ date: "2026-10-09", balance: 10000 });
    // 9 Oct to 9 Nov is 31 days: 10,000 - 3,100.
    expect(f.end).toEqual({ date: "2026-11-09", balance: 6900 });
    expect(f.belowZero).toBeUndefined();
  });

  it("adds regular payments and income on their dates, without counting them twice", () => {
    const rent = ["2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"].map((d) => tx(d, "RENT TO LANDLORD", -15000));
    const salary = ["2026-07-28", "2026-08-28", "2026-09-28"].map((d) => tx(d, "NEFT CR SALARY ACME", 40000));
    const f = run(history(...rent, ...salary), 20000, "2026-10-09");
    if (!f.ok) throw new Error(f.reason);
    expect(f.dailySpend).toBe(100); // rent is not in the everyday average
    expect(f.events.map((e) => [e.date, e.amount])).toEqual([
      ["2026-10-28", 40000],
      ["2026-11-05", -15000],
    ]);
    expect(f.end.balance).toBe(20000 - 3100 + 40000 - 15000);
  });

  it("says when the balance may go below zero, and the lowest point", () => {
    const rent = ["2026-07-15", "2026-08-15", "2026-09-15"].map((d) => tx(d, "RENT TO LANDLORD", -15000));
    const f = run(history(...rent), 16000, "2026-10-09");
    if (!f.ok) throw new Error(f.reason);
    // Rent on 15 Oct: 16,000 - 600 - 15,000 = 400, then ₹100 a day: below zero on 20 Oct.
    expect(f.points.find((p) => p.date === "2026-10-15")?.balance).toBe(400);
    expect(f.belowZero).toBe("2026-10-20");
    expect(f.lowest.date).toBe("2026-11-09");
  });

  it("starts where the statements end, and counts what came due since", () => {
    // Statements end 30 Sep; rent on the 5th is due between then and today.
    const until = (rows: Transaction[]) => rows.filter((t) => t.date <= "2026-09-30");
    const rent = ["2026-07-05", "2026-08-05", "2026-09-05"].map((d) => tx(d, "RENT TO LANDLORD", -15000));
    const f = run(until(history(...rent)), 30000, "2026-09-30");
    if (!f.ok) throw new Error(f.reason);
    expect(f.start.date).toBe("2026-09-30");
    expect(f.events.map((e) => e.date)).toEqual(["2026-10-05", "2026-11-05"]);
  });

  it("leaves big one-off payments out of the everyday average, and says how many", () => {
    const f = run(history(tx("2026-09-01", "NEW PHONE", -60000)), 100000, "2026-10-09");
    if (!f.ok) throw new Error(f.reason);
    expect(f.leftOut).toBeGreaterThanOrEqual(1);
    expect(f.dailySpend).toBeLessThan(110);
  });

  it("leaves out money moved between your own accounts", () => {
    const own = tx("2026-09-10", "NEFT TO MY SBI", -50000, { userCategory: "Between my accounts" });
    const f = run(history(own), 10000, "2026-10-09");
    if (!f.ok) throw new Error(f.reason);
    expect(f.dailySpend).toBe(100);
  });

  it("refuses with too little history, or statements that end too long ago", () => {
    expect(run([tx("2026-10-01", "A", -100), tx("2026-10-08", "B", -100)], 1000, "2026-10-08")).toEqual({ ok: false, reason: "noHistory", lastDate: "2026-10-08" });
    expect(run([], 1000)).toEqual({ ok: false, reason: "noHistory" });
    const old = history().filter((t) => t.date <= "2026-08-01");
    expect(run(old, 1000, "2026-08-01")).toMatchObject({ ok: false, reason: "oldStatements" });
  });
});
