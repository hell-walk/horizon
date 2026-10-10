import { describe, expect, it } from "vitest";

import { combineTotals } from "@/lib/currency";

// ECB-style rates: 1 INR buys this much of each.
const rates = { base: "INR", date: "2026-10-09", rates: { USD: 0.01034, EUR: 0.00923 } };

describe("combineTotals", () => {
  it("adds balances in different currencies up in one", () => {
    const c = combineTotals({ INR: 10892.21, USD: 74.99 }, "INR", rates);
    expect(c.parts).toEqual([
      { currency: "INR", amount: 10892.21, inBase: 10892.21 },
      { currency: "USD", amount: 74.99, inBase: 7252.42, rate: 96.71 },
    ]);
    expect(c.total).toBe(18144.63);
    expect(c).toMatchObject({ missing: [], date: "2026-10-09" });
  });

  it("leaves out, and names, a currency with no published rate", () => {
    const c = combineTotals({ INR: 1000, AED: 500 }, "INR", rates);
    expect(c).toMatchObject({ total: 1000, missing: ["AED"] });
  });

  it("converts nothing without rates, or with rates for another base", () => {
    expect(combineTotals({ INR: 1000, USD: 10 }, "INR", null)).toMatchObject({ total: 1000, missing: ["USD"] });
    expect(combineTotals({ INR: 1000, USD: 10 }, "INR", { ...rates, base: "USD" })).toMatchObject({ missing: ["USD"] });
  });
});
