import { describe, expect, it } from "vitest";

import { OWN_TRANSFER } from "@/lib/finance/corrections";
import { looksLikeBill, parsePlanTerm, planDays, rechargeDaysKey, rechargeOperator, rechargePicture, setExtraPlans } from "@/lib/finance/recharges";

let n = 0;
const debit = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `r${++n}`, date, name, amount, type: "debit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

describe("recharges: prepaid and DTH top-ups by operator", () => {
  it("knows the operators, and leaves postpaid and broadband to the bills", () => {
    expect(rechargeOperator("UPI/DR/1/JIO PREP/YESB/PAYTM-JIOM/")).toBe("Jio");
    expect(rechargeOperator("WDL TFR UPI/DR/1/MYJIO/HDFC/MYJIO1.EAS/")).toBe("Jio");
    expect(rechargeOperator("AIRTEL PREPAID RECHARGE")).toBe("Airtel");
    expect(rechargeOperator("TATA PLAY DTH")).toBe("Tata Play");
    expect(rechargeOperator("AIRTEL POSTPAID BILL")).toBeUndefined();
    expect(rechargeOperator("JIOCINEMA PREMIUM")).toBeUndefined();
    expect(rechargeOperator("ZOMATO")).toBeUndefined();
  });

  it("the latest plan is the one in force, and a single recharge shows too", () => {
    const rows = [
      debit("2026-05-02", "UPI/DR/1/JIO PREP/YESB/PAYTM-JIOM/", 299),
      debit("2026-05-30", "UPI/DR/2/JIO PREP/YESB/PAYTM-JIOM/", 299),
      debit("2026-06-27", "UPI/DR/3/MYJIO/HDFC/MYJIO1.EAS/", 349),
      debit("2026-06-10", "TATA PLAY DTH", 400),
      debit("2026-06-12", "UPI/DR/4/JIO PREP/YESB/", 299, { userCategory: OWN_TRANSFER }),
    ];
    const p = rechargePicture(rows);
    expect(p.items.map((i) => i.operator)).toEqual(["Jio", "Tata Play"]);
    const jio = p.items[0];
    // Moved from ₹299 to ₹349 (both 28-day plans): ₹349 is what a month costs now.
    expect(jio).toMatchObject({ count: 3, amount: 349, since: "2026-06-27", total: 947, validityDays: 28, basis: "plan", last: "2026-06-27", next: "2026-07-25", lapsed: false });
    expect(jio.perMonth).toBeCloseTo((349 * 30.44) / 28, 0);
    expect(jio.payments.map((x) => x.days)).toEqual([28, 28, 28]);
    expect(p.items[1]).toMatchObject({ count: 1, total: 400, basis: "none" });
    expect(p.items[1].perMonth).toBeUndefined();
    expect(p.count).toBe(4);
  });

  it("plans added from the portal win over the built-in table, and bad rows are ignored", () => {
    expect(parsePlanTerm("Jio|1029|84")).toEqual({ operator: "Jio", price: 1029, days: 84 });
    expect(parsePlanTerm(" Airtel | 349 | 30 ")).toEqual({ operator: "Airtel", price: 349, days: 30 });
    for (const bad of ["Jio|349", "Jio|abc|28", "Jio|349|0", "Jio|349|9999", "|349|28", ""]) expect(parsePlanTerm(bad)).toBeNull();
    setExtraPlans([
      { operator: "Jio", price: 1029, days: 84 },
      { operator: "jio", price: 349, days: 30 },
    ]);
    try {
      expect(planDays("Jio", 1029)).toBe(84);
      expect(planDays("Jio", 349)).toBe(30); // the portal's row corrects the built-in 28
    } finally {
      setExtraPlans([]);
    }
    expect(planDays("Jio", 349)).toBe(28);
  });

  it("a plan's own length beats late recharges, and the person's word beats both", () => {
    // ₹349 Jio recharged every 42 days: a 28-day plan bought late, so a month costs 349 × 30.44 / 28, not / 42.
    const rows = ["2026-05-01", "2026-06-12", "2026-07-24", "2026-09-04"].map((d) => debit(d, "UPI/DR/1/JIO PREP/YESB/", 349));
    const byPlan = rechargePicture(rows).items[0];
    expect(byPlan).toMatchObject({ validityDays: 28, basis: "plan", next: "2026-10-02" });
    expect(byPlan.perMonth).toBeCloseTo((349 * 30.44) / 28, 0);
    expect(planDays("Jio", 349)).toBe(28);
    const byYou = rechargePicture(rows, { [rechargeDaysKey("Jio", 349)]: 30 }).items[0];
    expect(byYou).toMatchObject({ validityDays: 30, basis: "you" });
    // A length saved for the operator alone (before plans had their own) still counts for the current plan.
    expect(rechargePicture(rows, { Jio: 30 }).items[0]).toMatchObject({ validityDays: 30, basis: "you" });
    // A length saved for another price does not.
    expect(rechargePicture(rows, { [rechargeDaysKey("Jio", 299)]: 30 }).items[0]).toMatchObject({ validityDays: 28, basis: "plan" });
    // An unknown price falls back to the gaps.
    const odd = rechargePicture(["2026-05-01", "2026-06-12"].map((d) => debit(d, "UPI/DR/1/JIO PREP/YESB/", 223))).items[0];
    expect(odd).toMatchObject({ validityDays: 42, basis: "gaps" });
  });

  it("wifi and postpaid bills (GST on top, so paise) are left out, and small top-ups are add-ons that do not move the plan", () => {
    expect(looksLikeBill(1060.82)).toBe(true);
    expect(looksLikeBill(349)).toBe(false);
    expect(looksLikeBill(349.0000001)).toBe(false);
    // As seen in a real statement: two ₹349 plans, a ₹69 data add-on, and JioFiber ₹899 + 18% GST, all paid through MyJio.
    const rows = [
      debit("2026-05-31", "UPI/DR/1/Reliance/UTIB/jioprepaidpaytm/", 349),
      debit("2026-06-27", "UPI/DR/2/Jio Prep/YESB/paytm-jiom/", 349),
      debit("2026-08-27", "UPI/DR/3/Jio Prep/YESB/paytm-jiomobili/", 69),
      debit("2026-10-08", "WDL TFR UPI/DR/4/MYJIO/HDFC/myjio4.eas/", 1060.82),
    ];
    const p = rechargePicture(rows);
    expect(p.leftOut).toEqual([{ id: rows[3].id, operator: "Jio", date: "2026-10-08", amount: 1060.82 }]);
    const jio = p.items[0];
    expect(jio).toMatchObject({ amount: 349, since: "2026-06-27", validityDays: 28, next: "2026-07-25", count: 3, addOns: 1, total: 767, last: "2026-08-27" });
    expect(jio.payments[0]).toMatchObject({ amount: 69, kind: "addOn" });
    // The statements run to 8 Oct; the plan ran out on 25 Jul with no plan recharge after it.
    expect(jio.lapsed).toBe(true);
    expect(p.asOf).toBe("2026-10-08");
    expect(p.monthly).toBe(0);
  });

  it("a price no table knows takes its length from the gaps between recharges of that same price", () => {
    const rows = ["2026-01-01", "2026-03-02", "2026-05-01"].map((d) => debit(d, "TATA PLAY DTH", 1200));
    expect(rechargePicture(rows).items[0]).toMatchObject({ validityDays: 60, basis: "gaps", next: "2026-06-30" });
  });
});
