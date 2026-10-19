import { describe, expect, it } from "vitest";

import { findChecks, type CheckAccount } from "@/lib/checks";
import { OWN_TRANSFER } from "@/lib/corrections";
import { findRegular } from "@/lib/recurring";

const tx = (id: string, date: string, name: string, amount: number, type: "debit" | "credit" = "debit") =>
  ({ id, date, name, amount: type === "debit" ? -amount : amount, type }) as Transaction;
const account = (id: string, name: string, transactions: Transaction[]): CheckAccount => ({
  id,
  name,
  mask: "1234",
  currency: "INR",
  transactions,
  regular: findRegular(transactions, new Date("2026-10-01T00:00:00Z")),
});
const person = { firstName: "Aaditya", lastName: "Pandey" };
const base = { person, incomeKind: null, answered: [] as string[] };

describe("findChecks: the questions worth asking", () => {
  it("the same amount out of one account and into another within two days", () => {
    const sbi = account("sbi", "State Bank of India", [
      tx("d1", "2026-09-05", "UPI/DR/1/RAHUL KUMAR/SBIN/r@oksbi", 10000),
      tx("d2", "2026-09-20", "UPI/DR/2/SWIGGY", 300),
    ]);
    const pnb = account("pnb", "Punjab National Bank", [tx("c1", "2026-09-06", "UPI/CR/3/RAHUL KUMAR/PUNB/r@pnb", 10000, "credit")]);
    const checks = findChecks({ ...base, accounts: [sbi, pnb] });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      kind: "ownPair",
      key: "own:d1:c1",
      amount: 10000,
      from: { accountId: "sbi", txId: "d1" },
      to: { accountId: "pnb", txId: "c1" },
    });
  });

  it("not when one side is already marked as between the accounts, nor for small amounts", () => {
    const a = account("a", "A", [
      { ...tx("d1", "2026-09-05", "IMPS SELF", 5000), userCategory: OWN_TRANSFER } as Transaction,
      tx("d2", "2026-09-07", "UPI/DR/2/TEA", 20),
    ]);
    const b = account("b", "B", [tx("c1", "2026-09-05", "IMPS SELF", 5000, "credit"), tx("c2", "2026-09-07", "UPI/CR/2/TEA", 20, "credit")]);
    expect(findChecks({ ...base, accounts: [a, b] })).toEqual([]);
  });

  it("money in from someone carrying the person's own name", () => {
    const a = account("a", "A", [
      tx("c1", "2026-09-05", "UPI/CR/1/AADITYA PANDEY/PUNB/aadi@pnb", 3000, "credit"),
      tx("c2", "2026-09-06", "UPI/CR/2/RAHUL KUMAR/SBIN/r@oksbi", 500, "credit"),
    ]);
    const checks = findChecks({ ...base, accounts: [a] });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ kind: "ownCredit", key: "owncredit:aaditya pandey", payeeKey: "aaditya pandey", txId: "c1" });
  });

  it("the person's name in the UPI handle counts too (SBI puts the sender's id there); a surname alone does not", () => {
    const a = account("a", "A", [
      tx("c1", "2026-09-05", "UPI/CR/1/RANI S/PUNB/pandey.aaditya@pnb/UPI 2 AT 3 SOUTH CITY WDL TFR", 2000, "credit"),
      tx("c2", "2026-09-06", "UPI/CR/2/MEENA K/SBIN/AADITY4/UPI 2 AT 3 SOUTH CITY WDL TFR", 1500, "credit"),
      tx("c3", "2026-09-07", "UPI/CR/3/RAHUL PANDEY/SBIN/rahul22@oksbi", 500, "credit"),
    ]);
    const checks = findChecks({ ...base, accounts: [a] });
    expect(checks.map((c) => c.key).sort()).toEqual(["owncredit:meena k", "owncredit:rani s"]);
  });

  it("the salary, only for a salaried person who has not confirmed one", () => {
    const rows = [tx("s1", "2026-07-31", "NEFT/CR/INFOSYS LTD/SALARY", 62000, "credit"), tx("s2", "2026-08-31", "NEFT/CR/INFOSYS LTD/SALARY", 62000, "credit")];
    const a = account("a", "A", rows);
    expect(findChecks({ ...base, accounts: [a], incomeKind: "salaried" })).toMatchObject([
      { kind: "salary", key: "salary:infosys", payee: "Infosys", monthly: 62000 },
    ]);
    expect(findChecks({ ...base, accounts: [a], incomeKind: "salaried", salaryPrefer: "Infosys" })).toEqual([]);
    expect(findChecks({ ...base, accounts: [a], incomeKind: "salaried", salaryExclude: ["Infosys"] })).toEqual([]);
    expect(findChecks({ ...base, accounts: [a], incomeKind: "student" })).toEqual([]);
  });

  it("a payment on a rhythm that nothing explains", () => {
    const rows = [
      tx("r1", "2026-07-03", "UPI/DR/1/RAVI STORES/YESB/q1@ybl", 999),
      tx("r2", "2026-08-03", "UPI/DR/2/RAVI STORES/YESB/q1@ybl", 999),
      tx("r3", "2026-09-03", "UPI/DR/3/RAVI STORES/YESB/q1@ybl", 999),
    ];
    const checks = findChecks({ ...base, accounts: [account("a", "A", rows)] });
    expect(checks).toMatchObject([{ kind: "regularKind", key: "regular:ravi stores", payee: "Ravi Stores", amount: 999, cadence: "monthly", count: 3 }]);
  });

  it("not about a payee whose purpose is already known", () => {
    const rows = [
      tx("f1", "2026-07-03", "UPI/DR/1/SWIGGY/UTIB/swiggy@axis", 650),
      tx("f2", "2026-08-03", "UPI/DR/2/SWIGGY/UTIB/swiggy@axis", 650),
      tx("f3", "2026-09-03", "UPI/DR/3/SWIGGY/UTIB/swiggy@axis", 650),
    ];
    expect(findChecks({ ...base, accounts: [account("a", "A", rows)] })).toEqual([]);
  });

  it("never asks the same thing twice", () => {
    const rows = [
      tx("r1", "2026-07-03", "UPI/DR/1/RAVI STORES/YESB/q1@ybl", 999),
      tx("r2", "2026-08-03", "UPI/DR/2/RAVI STORES/YESB/q1@ybl", 999),
      tx("r3", "2026-09-03", "UPI/DR/3/RAVI STORES/YESB/q1@ybl", 999),
    ];
    expect(findChecks({ ...base, accounts: [account("a", "A", rows)], answered: ["regular:ravi stores"] })).toEqual([]);
  });
});
