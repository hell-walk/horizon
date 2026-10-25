import { describe, expect, it } from "vitest";

import { OWN_TRANSFER } from "@/lib/corrections";
import { rechargeOperator, rechargePicture } from "@/lib/recharges";

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
    expect(jio).toMatchObject({ count: 3, amount: 299, total: 947, everyDays: 28, last: "2026-06-27", next: "2026-07-25" });
    expect(jio.perMonth).toBeCloseTo((299 * 30.44) / 28, 0);
    expect(p.items[1]).toMatchObject({ count: 1, total: 400 });
    expect(p.items[1].everyDays).toBeUndefined();
    expect(p.count).toBe(4);
  });
});
