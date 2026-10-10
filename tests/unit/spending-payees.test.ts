import { describe, expect, it } from "vitest";

import { groupByPayee, isPersonPayment, payeeName, PEOPLE_GROUP } from "@/lib/payees";
import { groupBySpendType, spendType, splitUpi } from "@/lib/spending";

const tx = (name: string, amount: number, type = "debit", category = "") =>
  ({ id: `${name}-${amount}`, name, amount, type, date: "2025-11-01", category, paymentChannel: "other" }) as unknown as Transaction;

describe("spendType: plain-language buckets", () => {
  it.each([
    ["UPI/DR/5112/SNAPMINT FINANCIAL/YESB/snapmint@ybl", "Payment", "EMI & pay later"],
    ["UPI/DR/889/SLICE/ICIC/slice@icici", "Payment", "EMI & pay later"],
    ["UPI/DR/412/AMAZON PAY/YESB/amazon@apl", "Shopping", "Shopping"],
    ["UPI/DR/220/CHANDIGA/SBIN/chandigarh123@oksbi", "Payment", "UPI payments"],
    ["UPI/DR/531/ZOMATO", "", "Food"],
    ["UPI/DR/123456789012/RAMESH KUMAR/SBIN/ramesh@oksbi/Payment", "Payment", "UPI payments"],
    ["POS 412345XXXXXX1234 SOME STORE", "", "Card"],
    ["NEFT/CR/ACME TRADERS", "", "Bank transfer"],
    ["IMPS-P2A-4099-ACME TRADERS", "", "Bank transfer"],
    ["ATM/CASH WDL/DELHI", "", "Cash (ATM)"],
    ["Airtel postpaid", "Utilities", "Bills & recharges"],
    ["Netflix subscription", "Entertainment", "Subscriptions"],
    ["Uber 063015 SF**POOL**", "Travel", "Travel"],
    ["McDonalds", "Food and Drink", "Food"],
    ["SIP - Groww mutual fund", "", "Investments"],
    ["Rent", "Rent", "Rent"],
    ["Global Hub Services", "", "Other"],
    ["CHANDIGA", "Transfer", "UPI payments"],
    ["Rahul Sharma", "Transfer", "UPI payments"],
    ["priya.verma", "", "UPI payments"],
    ["Sharma General Stores", "Transfer", "Bank transfer"],
    ["NEFT/DR/RAMESH KUMAR", "Transfer", "Bank transfer"],
    ["Snapmint", "Transfer", "EMI & pay later"],
  ])("%s (%s) -> %s", (name, category, expected) => {
    expect(spendType({ name, category, paymentChannel: "other" } as Transaction)).toBe(expected);
  });
});

describe("groupBySpendType", () => {
  const groups = groupBySpendType([
    tx("UPI/DR/1/SNAPMINT", 900),
    tx("UPI/DR/2/SNAPMINT", 800),
    tx("UPI/DR/4/CHANDIGA/SBIN/x@oksbi", 2500),
    tx("UPI/DR/5/SLICE", 1558.65),
    tx("UPI/DR/6/AMAZON PAY", 500),
    tx("Swiggy", 20),
    tx("Mystery Enterprises", 17.7),
    tx("Netflix", 649),
    tx("Salary", 50000, "credit"),
  ]);

  it("returns at most five buckets with Other last", () => {
    expect(groups.length).toBeLessThanOrEqual(5);
    expect(groups.at(-1)?.name).toBe("Other");
  });
  it("shares add up to 100%", () => {
    expect(groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1, 9);
  });
  it("ignores money coming in", () => {
    expect(groups.reduce((s, g) => s + g.amount, 0)).toBeCloseTo(900 + 800 + 2500 + 1558.65 + 500 + 20 + 17.7 + 649, 6);
  });
  it("handles no transactions", () => {
    expect(groupBySpendType([])).toEqual([]);
  });
});

describe("splitUpi: people versus unrecognised UPI shops", () => {
  it("counts payments to people, and leaves out other spending and money in", () => {
    const split = splitUpi([
      tx("UPI/DR/1/RAMESH KUMAR/SBIN/r@oksbi", 500),
      tx("UPI/DR/2/RAMESH KUMAR/SBIN/r@oksbi", 300),
      tx("CHANDIGA", 2500, "debit", "Transfer"),
      tx("Swiggy", 99), // food, not UPI payments
      tx("UPI/CR/3/RAMESH KUMAR/SBIN/r@oksbi", 1000, "credit"), // money in
    ]);
    expect(split).toEqual({ people: { amount: 3300, count: 3 }, shops: { amount: 0, count: 0 } });
  });
});

describe("payeeName", () => {
  it.each([
    ["UPI/DR/531/ZOMATO", "Zomato"],
    ["UPI-SWIGGY-ORDER", "Swiggy"],
    ["NEFT/CR/INFOSYS LTD/SALARY", "Infosys"],
    ["ATM/CASH WDL/DELHI", "ATM cash"],
    ["CHQ PAID/RENT", "Rent"],
    ["POS 412345XXXXXX1234 RELIANCE FRESH", "Groceries"],
    ["UPI/DR/123456789012/RAMESH KUMAR/SBIN/ramesh@oksbi/Payment", "Ramesh Kumar"],
    ["IMPS-P2A-409912345678-ACME TRADERS", "Acme Traders"],
    ["Netflix subscription", "Netflix"],
    ["Transfer to Axis savings", "Axis Savings"],
    ["Apollo pharmacy", "Healthcare"],
    ["12/03/2025", "Other"],
  ])("%s -> %s", (raw, expected) => {
    expect(payeeName(raw)).toBe(expected);
  });
});

describe("isPersonPayment", () => {
  it.each([
    ["CHANDIGA", true],
    ["UPI/DR/1/RAMESH KUMAR/SBIN/r@oksbi", true],
    ["aaditya02", true],
    ["Snapmint", false],
    ["Swiggy order", false],
    ["Acme Traders", false],
    ["Rent", false],
    ["Axis savings", false],
  ])("%s -> %s", (raw, expected) => {
    expect(isPersonPayment(raw)).toBe(expected);
  });
});

describe("groupByPayee", () => {
  it("merges repeat payees and leaves out credits", () => {
    const groups = groupByPayee([tx("UPI/DR/1/ZOMATO", 300), tx("UPI/DR/2/ZOMATO", 500), tx("Swiggy order", 640), tx("NEFT/CR/INFOSYS", 145000, "credit"), tx("Rent", 28000)]);
    expect(groups.find((g) => g.name === "Zomato")).toMatchObject({ count: 2, amount: 800 });
    expect(groups.some((g) => g.name.includes("Infosys"))).toBe(false);
  });

  it("puts payments to people under one UPI payments group", () => {
    const people = groupByPayee([tx("UPI/DR/1/RAMESH KUMAR/SBIN/r@oksbi", 500), tx("CHANDIGA", 2500), tx("Swiggy order", 300)]);
    expect(people[0]).toMatchObject({ name: PEOPLE_GROUP, count: 2 });
  });
});
