import { describe, expect, it } from "vitest";

import { categorize } from "@/lib/finance/categories";
import { chargeKind, findCharges } from "@/lib/finance/charges";

// Narrations in the shapes Indian banks print their own charges (numbers made up).
describe("bank charges", () => {
  it.each([
    ["MIN BAL CHGS 01-07-26", "minBalance"],
    ["AMB CHRG INCL GST JUN 26", "minBalance"],
    ["NON MAINTENANCE CHARGES", "minBalance"],
    ["AVERAGE BALANCE CHARGES", "minBalance"],
    ["MAB CHARGES Q1", "minBalance"],
    ["SMS CHARGES APR-JUN", "sms"],
    ["SMS ALERT CHGS INCL GST", "sms"],
    ["DEBIT CARD ANNUAL FEE", "card"],
    ["Chrg: Debit Card Annual Fee 4521", "card"],
    ["DCARDFEE5678MAR26", "card"],
    ["ATM AMC CHGS", "card"],
    ["ATM WDL CHGS 6TH TXN", "atm"],
    ["NFS ATM DECLINE CHG", "atm"],
    ["ECS RTN CHGS BAJAJ FIN", "bounce"],
    ["ACH DEBIT RETURN CHARGES", "bounce"],
    ["INSUFFICIENT BAL CHG", "bounce"],
    ["LATE PAYMENT FEE", "late"],
    ["FOREX MARKUP FEE", "forex"],
    ["IMPS P2A CHRG", "transfer"],
    ["NEFT CHGS", "transfer"],
    ["CHQ BOOK ISSUE CHGS", "chequeBook"],
    ["CASH DEP CHGS", "cash"],
    ["DUPLICATE STATEMENT CHARGES", "statement"],
    ["IGST @18% ON CHARGES", "gst"],
    ["CGST", "gst"],
    ["CONSOLIDATED CHARGES FOR A/C", "other"],
  ])("%s is a charge (%s)", (name, kind) => {
    expect(chargeKind(name)).toBe(kind);
    expect(categorize(name, "debit")).toBe("Bank Fees");
  });

  it.each([
    "UPI/DR/512345678901/ABC SCHOOL/YESB/abcschool@ybl/fees",
    "NEFT DR XYZ COLLEGE TUITION FEE",
    "IRCTC CONVENIENCE FEE",
    "GST PMT CPIN 26070000012345",
    "ATM CASH WDL 12/07 MUMBAI",
    "CHQ RETURN 004512",
    "POS ZOMATO PLATFORM FEE",
    "NACH/HDFC AMC LTD/SIP",
    "SALARY JUL 26",
  ])("%s is not a bank charge", (name) => {
    expect(chargeKind(name)).toBeNull();
  });

  it("adds up the last 12 months by kind, with what was given back", () => {
    const tx = (id: string, date: string, name: string, amount: number, type = "debit") => ({
      id,
      date,
      name,
      amount: type === "debit" ? -amount : amount,
      type,
    });
    const report = findCharges([
      tx("1", "2026-09-30", "SMS CHARGES JUL-SEP", 17.7),
      tx("2", "2026-06-30", "SMS CHARGES APR-JUN", 17.7),
      tx("3", "2026-08-05", "MIN BAL CHGS", 590),
      tx("4", "2026-08-20", "MIN BAL CHGS REVERSAL", 590, "credit"),
      tx("5", "2026-03-01", "DEBIT CARD ANNUAL FEE", 236),
      tx("6", "2025-07-01", "DEBIT CARD ANNUAL FEE", 236), // over a year before the last entry
      tx("7", "2026-09-01", "SWIGGY", 450),
    ]);
    expect(report).toMatchObject({ total: 861.4, refunded: 590, count: 4, to: "2026-09-30", from: "2025-09-30" });
    expect(report?.groups.map((g) => g.kind)).toEqual(["minBalance", "card", "sms"]);
    expect(report?.groups[2]).toMatchObject({ amount: 35.4, count: 2 });
  });

  it("knows how much of the year the statements cover", () => {
    const report = findCharges([
      { id: "1", date: "2026-07-01", name: "OPENING", amount: 10, type: "credit" },
      { id: "2", date: "2026-09-30", name: "SMS CHARGES", amount: -17.7, type: "debit" },
    ]);
    expect(report?.months).toBe(3);
    expect(findCharges([])).toBeNull();
  });
});

describe("money sent with a note is not a charge", () => {
  it.each(["IMPS/P2A/612345678901/RAHUL SHARMA/fees", "NEFT/N123456/PRIYA/transfer fee"])("%s", (name) => {
    expect(chargeKind(name)).toBeNull();
  });
});

describe("the request to the bank", () => {
  it("lists every charge with the total, and adds the RBI minimum-balance rule only when it applies", async () => {
    const { reversalRequest } = await import("@/lib/finance/chargesLetter");
    const tx = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount: -amount, type: "debit" });
    const report = findCharges([tx("1", "2026-09-30", "SMS CHARGES", 17.7), tx("2", "2026-08-05", "MIN BAL CHGS", 590)])!;
    const letter = reversalRequest({ bank: "HDFC Bank", mask: "4521", currency: "INR", report, holder: "Aarav Mehta" });
    expect(letter).toContain("account ending 4521");
    expect(letter).toContain("30 Sept 2026: SMS CHARGES (SMS alert charge)");
    expect(letter).toMatch(/Total charged: ₹607\.70/);
    expect(letter).toContain("below zero");
    expect(letter.trim().endsWith("Aarav Mehta")).toBe(true);

    const smsOnly = findCharges([tx("1", "2026-09-30", "SMS CHARGES", 17.7)])!;
    expect(reversalRequest({ bank: "HDFC Bank", mask: "", currency: "INR", report: smsOnly, holder: "" })).not.toContain("below zero");
  });
});

describe("charges already given back", () => {
  it("are left out of the request, and a partial reversal is mentioned", async () => {
    const { reversalRequest } = await import("@/lib/finance/chargesLetter");
    const tx = (id: string, date: string, name: string, amount: number, type = "debit") => ({
      id,
      date,
      name,
      amount: type === "debit" ? -amount : amount,
      type,
    });
    const report = findCharges([
      tx("1", "2026-08-01", "MIN BAL CHGS", 354),
      tx("2", "2026-08-20", "MIN BAL CHGS REVERSAL", 354, "credit"),
      tx("3", "2026-09-30", "SMS CHARGES", 17.7),
      tx("4", "2026-06-30", "SMS CHARGES", 17.7),
      tx("5", "2026-07-15", "SMS CHG REV", 17.7, "credit"),
    ])!;
    const letter = reversalRequest({ bank: "Test Bank", mask: "1234", currency: "INR", report, holder: "A" });
    expect(letter).not.toContain("MIN BAL");
    expect(letter).not.toContain("below zero");
    expect(letter).toContain("Total charged: ₹35.40 (of which ₹17.70 has already been reversed)");
  });
});

describe("investment fees", () => {
  it("a demat or broking fee is an investment cost, not a bank charge", async () => {
    const { spendType } = await import("@/lib/finance/spending");
    const demat = "WDL TFR CMP SBI CAPS DEMAT CHARGESDEMAT CHARGES 1 1 OF SBICAP SECURITI";
    expect(chargeKind(demat)).toBeNull();
    expect(chargeKind("CDSL AMC CHARGES")).toBeNull();
    expect(spendType({ name: demat } as Transaction)).toBe("Investments");
    // The bank's own SMS charge, as SBI prints it, still is one.
    expect(chargeKind("SMS CHRG FOR:01-04-2026TO30-06-2026")).toBe("sms");
  });
});
