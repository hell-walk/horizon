import { describe, expect, it } from "vitest";

import { findLoans, lenderOf, loadBand, loanTypeOf } from "@/lib/loans";
import { findRegular } from "@/lib/recurring";

describe("lenders by name", () => {
  it.each([
    ["ACH D- BAJAJ FINANCE LTD", "Bajaj Finance", "nbfc"],
    ["UPI/DR/1/Amazon P/UTIB/amazonpaylaterr/", "Amazon Pay Later", "payLater"],
    ["UPI/DR/1/KreditBee/YESB/kreditbee@ybl/", "KreditBee", "app"],
    ["ACH D- HERO FINCORP LTD", "Hero FinCorp", "nbfc"],
    ["KOTAK MAHINDRA PRIME LTD NACH", "Kotak Mahindra Prime", "nbfc"],
    ["ACH D- HDFC BANK CAR LOAN EMI", "HDFC Bank", "bank"],
    ["ICICI PAYLATER REPAYMENT", "ICICI PayLater", "payLater"],
    ["NACH MUTHOOT CAPITAL SERVICES", "Muthoot Capital", "nbfc"],
  ])("%s is %s", (text, name, kind) => {
    expect(lenderOf(text)).toMatchObject({ name, kind });
  });

  it("works out the loan type from the words, else from the lender", () => {
    expect(loanTypeOf("ACH D- HDFC BANK CAR LOAN EMI")).toBe("car");
    expect(loanTypeOf("SBI HOME LOAN EMI 0045")).toBe("home");
    expect(loanTypeOf("ACH D- HERO FINCORP LTD")).toBe("twoWheeler");
    expect(loanTypeOf("MUTHOOT FINANCE GOLD")).toBe("gold");
    expect(loanTypeOf("UPI/DR/1/slice/NESF/borrowrepayment/UPI")).toBe("payLater");
    expect(loanTypeOf("ICICI CREDIT CARD EMI 3/12")).toBe("creditCard");
    expect(loanTypeOf("ACH D- BAJAJ FINANCE LTD")).toBeNull();
  });
});

const debit = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount: -amount, type: "debit" }) as Transaction;
const credit = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount, type: "credit" }) as Transaction;
const monthly = (prefix: string, name: string, amount: number, months: string[], day = "05") =>
  months.map((m, i) => debit(`${prefix}${i}`, `${m}-${day}`, name, amount));
const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

describe("the loan picture", () => {
  const tx = [
    ...monthly("s", "NEFT CR-ACME TECH-SALARY", 0, []),
    ...MONTHS.map((m, i) => credit(`sal${i}`, `${m}-01`, "NEFT CR-ACME TECHNOLOGIES-SALARY", 60000)),
    ...monthly("car", "ACH D- HDFC BANK CAR LOAN EMI", 12000, MONTHS),
    ...monthly("kb", "UPI/DR/1/KreditBee/YESB/kreditbee@ybl/", 3000, MONTHS.slice(2), "10"),
    credit("kbin", "2026-07-02", "IMPS CR KREDITBEE DISBURSAL", 15000),
    debit("simpl1", "2026-09-03", "UPI-SIMPL PAY LATER-SETTLEMENT", 1800),
    debit("bounce", "2026-08-11", "ECS RTN CHGS KREDITBEE", 590),
    ...monthly("old", "ACH D- TVS CREDIT SERVICES", 2500, ["2025-12", "2026-01", "2026-02"]),
    debit("food", "2026-09-07", "UPI-SWIGGY-ORDER", 400),
  ];
  const report = findLoans([{ currency: "INR", transactions: tx, regular: findRegular(tx, new Date("2026-09-30")) }]);
  const by = (name: string) => report.loans.find((l) => l.lender === name)!;

  it("finds each lender, with its type, monthly amount and status", () => {
    expect(report.loans.map((l) => l.lender).sort()).toEqual(["HDFC Bank", "KreditBee", "Simpl", "TVS Credit"]);
    expect(by("HDFC Bank")).toMatchObject({ kind: "bank", type: "car", monthly: 12000, steady: true, status: "active", count: 5, cost: "medium" });
    expect(by("KreditBee")).toMatchObject({ kind: "app", type: "personal", monthly: 3000, borrowed: 15000, bounces: 1, bounceCharges: 590, cost: "high" });
    expect(by("TVS Credit")).toMatchObject({ status: "ended", type: "twoWheeler" });
  });

  it("adds up active EMIs against income, and counts quick credit", () => {
    expect(report.activeCount).toBe(3);
    expect(report.monthly.INR).toBeGreaterThan(15000);
    expect(report.income.INR).toBe(60000);
    expect(report.quickCreditCount).toBe(2);
    expect(report.bounces).toBe(1);
  });

  it("puts the usually costliest first, ended loans out", () => {
    const order = report.closeFirst.map((k) => k.split("|")[0]);
    expect(order[order.length - 1]).toBe("HDFC Bank");
    expect(order).not.toContain("TVS Credit");
    expect(order.slice(0, 2).sort()).toEqual(["KreditBee", "Simpl"]);
  });

  it("names the burden in bands", () => {
    expect(loadBand(0.2)).toBe("ok");
    expect(loadBand(0.4)).toBe("stretched");
    expect(loadBand(0.6)).toBe("heavy");
  });
});

describe('"ACH D-" auto-debits', () => {
  it("each keep their own payee, so two EMIs are two regular payments", async () => {
    const { payeeKey } = await import("@/lib/corrections");
    expect(payeeKey("ACH D- HDFC BANK CAR LOAN EMI")).not.toBe(payeeKey("ACH D- TVS CREDIT SERVICES"));
    expect(payeeKey("ACH D- TVS CREDIT SERVICES")).toBe("tvs services");
    expect(payeeKey("UPI/DR/1/R KUMAR/YESB/rk@ybl/")).toBe("r kumar"); // initials in a name stay
  });
});

describe("irregular payments", () => {
  it("are averaged over the calendar months they span", () => {
    const tx = [
      debit("a", "2026-08-03", "UPI-SIMPL PAY LATER-SETTLEMENT", 2100),
      debit("b", "2026-09-03", "UPI-SIMPL PAY LATER-SETTLEMENT", 2200),
      debit("c", "2026-09-12", "SWIGGY", 100),
    ];
    const report = findLoans([{ currency: "INR", transactions: tx, regular: [] }]);
    expect(report.loans[0]).toMatchObject({ lender: "Simpl", monthly: 2150, steady: false });
  });
});
