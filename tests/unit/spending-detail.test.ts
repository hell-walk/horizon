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

  it("breaks UPI down by who was paid: seven and Other in the pie, everyone in the list", () => {
    const names = ["Aman Verma", "Rahul Kumar", "Priya S", "Gupta Tent House", "Sunita Devi", "Ankit Jain", "Ravi Stores", "Meena K", "Book Hub"];
    const rows = names.map((n, i) => debit(`u${i}`, "2026-09-10", `WDL TFR UPI/DR/65921488465${i}/${n}/YESB/x${i}@ybl/Paid vi 0097 AT 16727`, 900 - i * 50));
    const upi = spendingDetail(rows, "upi-payments")!;
    // Each by its own name, not the phone company Vi ("Paid vi..." is the bank cutting "Paid via" short).
    expect(upi.payees.map((p) => p.name)).toEqual([...names.slice(0, 7), "Other"]);
    expect(upi.payees.at(-1)!.amount).toBe(550 + 500);
    expect(upi.allPayees.map((p) => p.name)).toEqual(names);
    expect(upi.allPayees.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1);
  });

  it("breaks EMIs down by lender", () => {
    const rows = [
      debit("l1", "2026-08-05", "ACH D- BAJAJ FINANCE LTD-P400PHT1234", 2100),
      debit("l2", "2026-09-05", "ACH D- BAJAJ FINANCE LTD-P400PHT1234", 2100),
      debit("l3", "2026-09-07", "UPI/DR/7/KreditBee/YESB/kreditbee@ybl/EMI", 900),
      debit("l4", "2026-09-09", "UPI/DR/8/Simpl/YESB/simpl@ybl/pay later", 430),
    ];
    const emi = spendingDetail(rows, "emi-pay-later")!;
    expect(emi.payees.map((p) => [p.name, p.amount])).toEqual([
      ["Bajaj Finance", 4200],
      ["KreditBee", 900],
      ["Simpl", 430],
    ]);
  });

  it("knows no bucket by an unknown name", () => {
    expect(spendingDetail(tx, "no-such-thing")).toBeNull();
    expect(spendingDetail([], "food")).toBeNull();
  });
});

describe("Account history's chart groups", () => {
  it("are the Home chart's kinds of spending, each with its own payments", async () => {
    const { groupBySpendTypeWithEntries, groupBySpendType } = await import("@/lib/spending");
    const groups = groupBySpendTypeWithEntries(tx, 8);
    expect(groups.map((g) => [g.name, g.amount])).toEqual(groupBySpendType(tx, 8).map((b) => [b.name, b.amount]));
    const food = groups.find((g) => g.name === "Food")!;
    expect(food.transactions.map((t) => t.id).sort()).toEqual(["a", "b", "c", "d"]);
    expect(groups.flatMap((g) => g.transactions).some((t) => t.id === "own")).toBe(false); // between own accounts: not spending
  });
});
