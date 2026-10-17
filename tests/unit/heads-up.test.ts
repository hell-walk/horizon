import { describe, expect, it } from "vitest";

import { headsUp } from "@/lib/headsUp";
import { findRegular } from "@/lib/recurring";

const debit = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount: -amount, type: "debit" }) as Transaction;
const account = { id: "a1", name: "HDFC Bank", mask: "4821", currency: "INR" };
const input = (transactions: Transaction[], balance: number | null, today: Date) => ({
  account,
  balance,
  transactions,
  regular: findRegular(transactions, today),
});

describe("be prepared", () => {
  const today = new Date("2026-10-02T00:00:00Z");
  const tx = [
    ...["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05"].map((d, i) => debit(`car${i}`, d, "ACH D- HDFC BANK CAR LOAN EMI", 12000)),
    debit("sms", "2026-07-10", "SMS CHARGES APR-JUN 26", 17.7),
    debit("card", "2025-10-20", "DEBIT CARD ANNUAL FEE", 236),
    debit("amb", "2026-09-01", "MIN BAL CHGS AUG 26", 354),
    debit("last", "2026-09-30", "UPI/DR/1/SWIGGY/YESB/swiggy@ybl/", 300),
  ];

  it("names the EMI due this week by its lender, and warns when the balance will not cover it", () => {
    const { items, staleSince } = headsUp([input(tx, 5000, today)], today);
    expect(items[0]).toMatchObject({ kind: "shortfall", balance: 5000, needed: 12000, asOf: "2026-09-30" });
    expect(items).toContainEqual(expect.objectContaining({ kind: "emi", lender: "HDFC Bank", amount: 12000, date: "2026-10-05", days: 3 }));
    expect(staleSince).toBeNull();
  });

  it("no shortfall when the balance covers it, or when the balance is unknown", () => {
    expect(headsUp([input(tx, 50000, today)], today).items.some((i) => i.kind === "shortfall")).toBe(false);
    expect(headsUp([input(tx, null, today)], today).items.some((i) => i.kind === "shortfall")).toBe(false);
  });

  it("sees the quarterly SMS fee and the yearly card fee coming, and a recent minimum-balance penalty", () => {
    const { items } = headsUp([input(tx, 50000, today)], today);
    expect(items).toContainEqual(expect.objectContaining({ kind: "charge", charge: "sms", amount: 17.7, date: "2026-10-10", days: 8 }));
    expect(items).toContainEqual(expect.objectContaining({ kind: "charge", charge: "card", amount: 236, date: "2026-10-20", days: 18 }));
    expect(items).toContainEqual(expect.objectContaining({ kind: "minBalance", amount: 354, date: "2026-09-01" }));
    expect(items.at(-1)?.kind).toBe("minBalance"); // the reminder goes last; money leaving soon goes first
  });

  it("says when the statements are too old for exact reminders", () => {
    const later = new Date("2026-11-20T00:00:00Z");
    expect(headsUp([input(tx, 50000, later)], later).staleSince).toBe("2026-09-30");
    expect(headsUp([input(tx, 5000, later)], later).items.some((i) => i.kind === "shortfall")).toBe(false); // an old balance proves nothing
  });
});
