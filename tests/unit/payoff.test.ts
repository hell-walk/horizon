import { describe, expect, it } from "vitest";

import { comparePayoff, monthsFrom, payoff } from "@/lib/payoff";

const today = new Date("2026-10-20T00:00:00Z");

describe("payoff: a reducing-balance loan, month by month", () => {
  it("a five-year loan at 10% runs out in 60 months with the textbook interest", () => {
    // 5,00,000 at 10% over 60 months: the standard EMI is 10,624.
    const p = payoff({ outstanding: 500000, annualRate: 10, emi: 10624 }, today)!;
    expect(p.months).toBe(60);
    expect(p.interest).toBeCloseTo(137400, -3);
    expect(p.payoffDate).toBe("2031-10-20");
  });

  it("extra money every month, or once, shortens it and saves interest", () => {
    const plan = comparePayoff({ outstanding: 500000, annualRate: 10, emi: 10624, extraMonthly: 2000 }, today)!;
    expect(plan.faster.months).toBeLessThan(plan.baseline.months);
    expect(plan.interestSaved).toBeGreaterThan(20000);
    expect(plan.monthsSaved).toBe(plan.baseline.months - plan.faster.months);
    const lump = comparePayoff({ outstanding: 500000, annualRate: 10, emi: 10624, lumpSum: 100000 }, today)!;
    expect(lump.faster.months).toBeLessThan(50);
    // The lump sum plus every EMI, the last one smaller than the rest.
    expect(lump.faster.totalPaid).toBeLessThanOrEqual(100000 + lump.faster.months * 10624);
    expect(lump.faster.totalPaid).toBeGreaterThan(100000 + (lump.faster.months - 1) * 10624);
  });

  it("says so when the EMI cannot cover the interest, and handles no interest at all", () => {
    expect(payoff({ outstanding: 500000, annualRate: 30, emi: 10000 }, today)).toBeNull();
    expect(payoff({ outstanding: 12000, annualRate: 0, emi: 1000 }, today)).toMatchObject({ months: 12, interest: 0, totalPaid: 12000 });
  });

  it("a prepayment covering everything ends it now", () => {
    expect(payoff({ outstanding: 50000, annualRate: 12, emi: 5000, lumpSum: 60000 }, today)).toMatchObject({ months: 0, interest: 0 });
  });

  it("counts months on the calendar, clamping to the last day", () => {
    expect(monthsFrom(new Date("2026-01-31T00:00:00Z"), 1)).toBe("2026-02-28");
    expect(monthsFrom(new Date("2026-11-15T00:00:00Z"), 3)).toBe("2027-02-15");
  });
});
