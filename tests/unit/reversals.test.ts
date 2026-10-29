import { describe, expect, it } from "vitest";

import { REVERSED } from "@/lib/finance/corrections";
import { creditsPerMonth } from "@/lib/finance/income";
import { findRegular } from "@/lib/finance/recurring";
import { findReversals, markReversals } from "@/lib/finance/reversals";
import { groupBySpendType } from "@/lib/finance/spending";

let n = 0;
const row = (date: string, name: string, amount: number, type: "debit" | "credit", extra: Partial<Transaction> = {}) =>
  ({ id: `r${++n}`, date, name, amount, type, category: "Payment", paymentChannel: "other", ...extra }) as Transaction;

describe("reversed payments", () => {
  it("pairs a debit with the credit that brings the same amount back under the same reference, within three days", () => {
    const out = row("2024-07-20", "UPI/DR/420112345678/SOME SHOP/YESB/paytm/", 20000, "debit");
    const back = row("2024-07-22", "UPI/CR/420112345678/SOME SHOP/YESB/paytm/", 20000, "credit");
    const other = row("2024-07-21", "UPI/CR/999988887777/A FRIEND/SBIN/", 20000, "credit");
    expect(findReversals([out, other, back])).toEqual(new Set([out.id, back.id]));
  });

  it("pairs on wording when the credit carries no reference, and never across more than three days", () => {
    const out = row("2024-08-01", "POS 1234 SOME STORE", 407, "debit");
    const back = row("2024-08-03", "REFUND SOME STORE", 407, "credit");
    expect(findReversals([out, back])).toEqual(new Set([out.id, back.id]));
    const late = row("2024-08-09", "REFUND SOME STORE", 407, "credit");
    expect(findReversals([out, late]).size).toBe(0);
  });

  it("does not pair different amounts, the same direction, or a row the person has labelled", () => {
    const a = row("2024-08-01", "UPI/DR/420100000001/X/", 100, "debit");
    const b = row("2024-08-01", "UPI/CR/420100000001/X/", 101, "credit");
    const c = row("2024-08-01", "UPI/DR/420100000002/X/", 100, "debit");
    const d = row("2024-08-01", "UPI/DR/420100000002/X/", 100, "debit");
    expect(findReversals([a, b, c, d]).size).toBe(0);
    const labelled = row("2024-08-01", "UPI/DR/420100000003/X/", 50, "debit", { userCategory: "Food" });
    const refund = row("2024-08-01", "UPI/CR/420100000003/X/", 50, "credit");
    expect(findReversals([labelled, refund]).size).toBe(0);
  });

  it("marks both rows Reversed and every total leaves them out", () => {
    const rows = [
      row("2024-07-20", "UPI/DR/420112345678/SOME SHOP/YESB/", 20000, "debit"),
      row("2024-07-20", "UPI/CR/420112345678/SOME SHOP/YESB/", 20000, "credit"),
      row("2024-07-21", "UPI/DR/420199999999/SWIGGY/", 350, "debit"),
      row("2024-07-25", "NEFT CR-ACME LTD-SALARY", 60000, "credit"),
    ];
    const marked = markReversals(rows);
    expect(marked.filter((t) => t.userCategory === REVERSED).map((t) => t.changedBy)).toEqual(["pair", "pair"]);
    expect(marked[2].userCategory).toBeUndefined();
    // Spending: only the Swiggy order. Money in: only the salary. No rhythm from the pair.
    const spent = groupBySpendType(marked);
    expect(spent.reduce((s, b) => s + b.amount, 0)).toBe(350);
    expect(creditsPerMonth(marked).monthly).toBe(60000);
    expect(findRegular(marked, new Date("2024-08-01T00:00:00Z")).every((r) => r.amount !== 20000)).toBe(true);
    // Nothing paired: the same rows come back.
    expect(markReversals([rows[2]])).toEqual([rows[2]]);
  });
});
