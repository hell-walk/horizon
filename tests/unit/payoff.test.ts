import { describe, expect, it } from "vitest";

import { comparePayoff, monthsFrom, outstandingFromSchedule, payoff, scheduleFrom } from "@/lib/finance/payoff";

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

  it("lays out the EMIs from when the loan was taken and for how long", () => {
    // Taken 10 March for 12 months, on the lender's 3rd: first EMI 3 April, last 3 March next year; by 20 Oct, seven paid.
    expect(scheduleFrom({ borrowed: "2026-03-10", tenure: 12, dueDay: 3, today })).toEqual({
      firstDue: "2026-04-03",
      paid: 7,
      remaining: 5,
      endDate: "2027-03-03",
    });
    // Without a lender day, the same day of the month as the loan.
    expect(scheduleFrom({ borrowed: "2026-01-31", tenure: 3, today })).toEqual({ firstDue: "2026-02-28", paid: 3, remaining: 0, endDate: "2026-04-30" });
    // Snapmint after the 26th: the first EMI skips a month.
    expect(scheduleFrom({ borrowed: "2026-09-28", tenure: 3, dueDay: 3, cutoffDay: 26, today })!.firstDue).toBe("2026-11-03");
    expect(scheduleFrom({ borrowed: "2026-09-20", tenure: 3, dueDay: 3, cutoffDay: 26, today })!.firstDue).toBe("2026-10-03");
    expect(scheduleFrom({ borrowed: "not a date", tenure: 3, today })).toBeNull();
  });

  it("works out what is still owed from the EMI, the rate and the months left", () => {
    // 10,624 a month at 10% with 60 left is the 5,00,000 loan.
    expect(outstandingFromSchedule({ emi: 10624, annualRate: 10, remaining: 60 })).toBeCloseTo(500000, -3);
    expect(outstandingFromSchedule({ emi: 1000, annualRate: 0, remaining: 12 })).toBe(12000);
    expect(outstandingFromSchedule({ emi: 1000, annualRate: 12, remaining: 0 })).toBe(0);
  });

  it("counts months on the calendar, clamping to the last day", () => {
    expect(monthsFrom(new Date("2026-01-31T00:00:00Z"), 1)).toBe("2026-02-28");
    expect(monthsFrom(new Date("2026-11-15T00:00:00Z"), 3)).toBe("2027-02-15");
  });
});
