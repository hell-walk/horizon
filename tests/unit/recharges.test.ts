import { describe, expect, it } from "vitest";

import { OWN_TRANSFER } from "@/lib/corrections";
import { parsePlanTerm, planDays, rechargeOperator, rechargePicture, setExtraPlans } from "@/lib/recharges";

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

  it("reads how often and about how much a month from the gaps, and shows a single recharge too", () => {
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
    // ₹299 is a 28-day Jio plan: the plan's length is used, and the gaps agree.
    expect(jio).toMatchObject({ count: 3, amount: 299, total: 947, everyDays: 28, validityDays: 28, basis: "plan", last: "2026-06-27", next: "2026-07-25" });
    expect(jio.perMonth).toBeCloseTo((299 * 30.44) / 28, 0);
    expect(p.items[1]).toMatchObject({ count: 1, total: 400, basis: "none" });
    expect(p.items[1].everyDays).toBeUndefined();
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
    expect(byPlan).toMatchObject({ everyDays: 42, validityDays: 28, basis: "plan", next: "2026-10-02" });
    expect(byPlan.perMonth).toBeCloseTo((349 * 30.44) / 28, 0);
    expect(planDays("Jio", 349)).toBe(28);
    const byYou = rechargePicture(rows, { Jio: 30 }).items[0];
    expect(byYou).toMatchObject({ validityDays: 30, basis: "you" });
    // An unknown price falls back to the gaps.
    const odd = rechargePicture(["2026-05-01", "2026-06-12"].map((d) => debit(d, "UPI/DR/1/JIO PREP/YESB/", 123))).items[0];
    expect(odd).toMatchObject({ validityDays: 42, basis: "gaps" });
  });
});
