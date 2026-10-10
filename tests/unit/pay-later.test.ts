import { describe, expect, it } from "vitest";

import { categorize } from "@/lib/categories";
import { findRegular } from "@/lib/recurring";
import { groupBySpendType, spendType } from "@/lib/spending";

// Narrations in the shape Indian banks print them (numbers made up).
const SNAPMINT = "UPI/DR/512345678901/SNAPMINT/UTIB/snapmintfinanci/";
const SLICE = "UPI/DR/512345678902/slice/NESF/borrowrepayment/UPI";
const SLICE_CUT = "WDL TFR UPI/DR/512345678903/slice/NESF/borrowrepa /Paid vi 0000000000000 AT 00000 UTRETHIA , LUCKNOW";

describe("EMIs and pay-later apps", () => {
  it("are saved as EMI & pay later, not as a plain UPI payment", () => {
    for (const n of [
      SNAPMINT,
      SLICE,
      SLICE_CUT,
      "NACH/BAJAJ FINANCE LTD/EMI",
      "LOAN REPAYMENT HOME CREDIT",
      "UPI/DR/627400000000/Amazon P/UTIB/amazonpaylaterr/",
      "UPIDR627400000000Amazon PUTIBamazonpaylaterr", // as some screens join it
      "FLIPKART PAY LATER",
      "PAYTM POSTPAID BILL",
      "UPI/DR/1/KreditBee/YESB/kreditbee@ybl/",
      "UPI/DR/1/Fibe/ICIC/fibe.repay@icici/",
    ]) {
      expect(categorize(n), n).toBe("EMI & pay later");
      expect(spendType({ name: n, category: "Shopping" } as Transaction), n).toBe("EMI & pay later");
    }
    // Look-alikes that are not borrowing.
    expect(categorize("AMAZON PAY UPI/shopping")).toBe("Shopping");
    expect(categorize("AIRTEL POSTPAID")).toBe("Bills");
    // Airtel AirFiber, cut short by the bank: broadband, not the lender Fibe.
    expect(categorize("UPI/DR/1/Air Fibe/YESB/paytm-1234/UPI")).toBe("Bills");
    expect(spendType({ name: "UPI/DR/1/Air Fibe/YESB/paytm-1234/UPI" } as Transaction)).toBe("Bills & recharges");
  });

  it('a bank cutting "Paid via" to "Paid vi" is not the phone company Vi', () => {
    expect(categorize("UPI/DR/1/SOME SHOP/Paid vi")).not.toBe("Bills");
    expect(categorize("VI PREPAID RECHARGE")).toBe("Bills");
  });

  it("go to the EMI group in the spending chart", () => {
    for (const n of [SNAPMINT, SLICE, SLICE_CUT]) expect(spendType({ name: n, category: "Payment" } as Transaction)).toBe("EMI & pay later");
  });

  it("a pizza slice is still food", () => {
    expect(spendType({ name: "POS PIZZA SLICE CORNER" } as Transaction)).toBe("Food");
  });

  it("are never folded into Other on the chart, however small", () => {
    const debit = (name: string, amount: number) => ({ name, amount: -amount, type: "debit" }) as Transaction;
    const tx = [debit("UPI/DR/1/rahul@ybl", 40000), debit("ATM CASH WDL", 30000), debit("AMAZON", 15000), debit("SWIGGY", 4000), debit("BIGBASKET", 3500), debit("AIRTEL", 900), debit(SNAPMINT, 700)];
    const chart = groupBySpendType(tx);
    expect(chart).toHaveLength(5);
    expect(chart.map((b) => b.name)).toContain("EMI & pay later");
    expect(chart.at(-1)?.name).toBe("Other");
    expect(chart.reduce((s, b) => s + b.amount, 0)).toBe(94100); // nothing lost
  });
});

describe("subscriptions", () => {
  it("Google Play billing and streaming services count as subscriptions", () => {
    for (const n of ["UPI/DR/512345678904/Google P/UTIB/playstore1.bd@axl/", "CRUNCHYROLL*MEGA FAN", "YOUTUBE PREMIUM", "SONY LIV", "ZEE5 SUBSCRIPTION"]) {
      expect(spendType({ name: n, category: "Payment" } as Transaction), n).toBe("Subscriptions");
    }
  });

  it("a known subscription seen once is shown as a likely monthly payment; a one-off shop is not", () => {
    const tx = (name: string, date: string) => ({ id: name, name, amount: -159, type: "debit", date }) as Transaction;
    const found = findRegular([tx("CRUNCHYROLL*MEGA FAN", "2026-09-05"), tx("SOME SHOP PURCHASE", "2026-09-07")], new Date("2026-09-20"));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "subscription", cadence: "monthly", confidence: "low", count: 1, next: "2026-10-05" });
  });
});
