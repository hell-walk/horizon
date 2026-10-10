import { describe, expect, it } from "vitest";

import { payeeName } from "@/lib/payees";
import { spendType } from "@/lib/spending";

const kind = (name: string) => spendType({ name, category: "Transfer", paymentChannel: "other" });

describe("merchants from other countries", () => {
  it.each([
    ["POS PURCHASE WALMART SUPERCENTER #1234", "Groceries"],
    ["WHOLE FOODS MARKET #10233", "Groceries"],
    ["TESCO STORES 3021 LONDON", "Groceries"],
    ["KARTENZAHLUNG REWE MARKT GMBH", "Groceries"],
    ["UBER EATS *ORDER 7X2", "Food"],
    ["DOORDASH*CHIPOTLE", "Food"],
    ["UBER *TRIP HELP.UBER.COM", "Travel"],
    ["RYANAIR DUBLIN", "Travel"],
    ["DIRECT DEBIT BRITISH GAS", "Bills & recharges"],
    ["COMCAST CABLE COMM", "Bills & recharges"],
    ["SEPA LASTSCHRIFT NETFLIX INTERNATIONAL", "Subscriptions"],
    ["KLARNA*PAYMENT", "EMI & pay later"],
    ["VANGUARD BUY INVESTMENT", "Investments"],
    ["CVS/PHARMACY #08712", "Health"],
    ["ZELLE PAYMENT TO JOHN SMITH", "Bank transfer"],
  ])("%s is %s", (narration, expected) => {
    expect(kind(narration)).toBe(expected);
  });

  it("still sorts Indian narrations as before", () => {
    expect(kind("UPI/DR/531/ZOMATO/SBIN/zomato@ybl")).toBe("Food");
    expect(kind("UPI/DR/12/BLINKIT")).toBe("Groceries");
    expect(kind("NACH/BAJAJ FINANCE EMI")).toBe("EMI & pay later");
  });

  it.each([
    ["POS PURCHASE WALMART SUPERCENTER #1234", "Walmart"],
    ["UBER EATS *ORDER 7X2", "Uber Eats"],
    ["ZELLE PAYMENT TO JOHN SMITH", "John Smith"],
    ["PAYPAL *SPOTIFY P1B2C3", "Spotify"],
    ["SEPA LASTSCHRIFT STADTWERKE MUENCHEN", "Stadtwerke Muenchen"],
  ])("names the payee of %s as %s", (narration, expected) => {
    expect(payeeName(narration)).toBe(expected);
  });
});
