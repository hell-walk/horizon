import { describe, expect, it } from "vitest";

import { buildCalendar } from "@/lib/finance/calendar";
import { findChecks } from "@/lib/finance/checks";
import { OWN_TRANSFER } from "@/lib/finance/corrections";
import { forecast } from "@/lib/finance/forecast";
import { healthScore } from "@/lib/finance/health";
import { estimateIncome } from "@/lib/finance/income";
import { findLoans } from "@/lib/finance/loans";
import { findRegular } from "@/lib/finance/recurring";
import { monthlyReport, reportMonths } from "@/lib/finance/report";
import { coverageOf } from "@/lib/statements/gaps";

// One household's statements, May to mid-September 2026, every figure chosen by
// hand so the numbers below can be checked on paper. The same rows go through
// every part of the pipeline: regular payments, income, health, the report, the
// forecast and calendar, the loans, coverage, and the questions. If any of them
// drifts, this is where it shows.
const credit = (date: string, name: string, amount: number, balance?: number) =>
  ({ id: `${date}-${name}`, date, name, amount, type: "credit", balance }) as Transaction & { balance?: number };
const debit = (date: string, name: string, amount: number, balance?: number) =>
  ({ id: `${date}-${name}`, date, name, amount: -amount, type: "debit", balance }) as Transaction & { balance?: number };

const MONTHS = ["05", "06", "07", "08"];
const rows: Transaction[] = [
  ...MONTHS.flatMap((m) => [
    credit(`2026-${m}-01`, "NEFT/CR/INFOSYS LTD/SALARY", 60000),
    debit(`2026-${m}-02`, "UPI/DR/1/RENT HOUSE OWNER/rent", 15000),
    debit(`2026-${m}-05`, "ACH D- BAJAJ FINANCE LTD-EMI", 9000),
    debit(`2026-${m}-10`, "UPI/DR/2/NETFLIX/UTIB/netflix@axis", 649),
    debit(`2026-${m}-15`, "UPI/DR/3/ZERODHA SIP", 10000),
    debit(`2026-${m}-18`, "UPI/DR/4/SWIGGY/UTIB/swiggy@axis", 2000),
    debit(`2026-${m}-20`, "UPI/DR/5/BIGBASKET/UTIB/bb@axis", 4000),
  ]),
  { ...debit("2026-07-25", "IMPS SELF", 5000), userCategory: OWN_TRANSFER } as Transaction,
  debit("2026-08-22", "SMS CHGS 01-04-26TO30-06-26", 17.7),
  credit("2026-09-01", "NEFT/CR/INFOSYS LTD/SALARY", 60000),
  debit("2026-09-02", "UPI/DR/1/RENT HOUSE OWNER/rent", 15000),
  debit("2026-09-05", "ACH D- BAJAJ FINANCE LTD-EMI", 9000),
  debit("2026-09-12", "UPI/DR/6/SWIGGY/UTIB/swiggy@axis", 500),
];
const today = new Date("2026-09-15T00:00:00Z");
const regular = findRegular(rows, today);

describe("the whole pipeline on one known set of statements", () => {
  it("finds the regular payments and the salary", () => {
    const names = regular
      .filter((r) => r.status !== "stopped")
      .map((r) => `${r.direction}:${r.kind}`)
      .sort();
    // Swiggy and BigBasket repeat too, but eating and groceries are not bills: they stay "other".
    expect(names).toEqual(["in:income", "out:emi", "out:other", "out:other", "out:rent", "out:saving", "out:subscription"].sort());
    expect(regular.find((r) => r.kind === "emi")).toMatchObject({ amount: 9000, cadence: "monthly", confidence: "high", next: "2026-10-05" });
  });

  it("reads the income the salaried way", () => {
    const income = estimateIncome(rows, "salaried");
    expect(income).toMatchObject({ source: "salary", monthly: 60000 });
    expect(income.salary).toMatchObject({ payee: "Infosys", months: 5 });
    // Money in per full month (June, July, August): the salary only.
    expect(income.creditsMonthly).toBe(60000);
    expect(income.months).toBe(3);
  });

  it("sums the health score from its parts", () => {
    const h = healthScore({ transactions: rows, regular, income: 60000, balance: 120000 });
    const part = (k: string) => h.parts.find((p) => p.key === k)!;
    // Spent a month: 15000 + 9000 + 649 + 2000 + 4000 = 30649 (+ the SMS charge over three months): about half kept.
    expect(part("savings").value).toBeCloseTo(0.489, 2);
    expect(part("savings").points).toBe(30);
    expect(part("emi")).toMatchObject({ points: 25 }); // 9000 of 60000 = 15%
    expect(part("commitments").value).toBeCloseTo((9000 + 15000 + 649 + 4000 * 0) / 60000, 1); // EMI, rent, subscription; groceries are not a bill
    expect(part("charges")).toMatchObject({ points: 7, value: 1 });
    expect(part("cushion").points).toBe(20); // 120000 covers nearly four months of 30655
    expect(h.score).toBe(97);
    expect(h.band).toBe("good");
  });

  it("reports August to the rupee", () => {
    expect(reportMonths(rows)).toEqual(["2026-08", "2026-07", "2026-06"]);
    const r = monthlyReport(rows, regular, "2026-08")!;
    expect(r.moneyIn).toBe(60000);
    expect(r.spent).toBe(30666.7); // 30649 + 17.70; the SIP is kept, not spent
    expect(r.invested).toBe(10000);
    expect(r.kept).toBe(29333.3);
    expect(r.emis).toEqual({ amount: 9000, count: 1 });
    expect(r.charges).toEqual({ amount: 17.7, count: 1 });
    expect(r.biggest[0]).toMatchObject({ name: "Rent", amount: 15000 });
    // Seen from the 15th of September: the salary, rent and EMI have already come this month, so only the rest is still due.
    expect(r.nextMonth.map((d) => d.kind).sort()).toEqual(["other", "saving", "subscription"]);
  });

  it("projects the balance and lays the calendar out", () => {
    const f = forecast({ balance: 120000, balanceDate: "2026-09-12", transactions: rows, regulars: regular, today, days: 30 });
    expect(f.ok).toBe(true);
    if (!f.ok) return;
    expect(f.start).toEqual({ date: "2026-09-12", balance: 120000 });
    // The regular payments still to come in September, then October's first ones.
    expect(
      f.events
        .filter((e) => e.date <= "2026-09-30")
        .map((e) => e.kind)
        .sort(),
    ).toEqual(["other", "saving", "subscription"]);
    expect(f.events.find((e) => e.kind === "income")).toMatchObject({ date: "2026-10-01", amount: 60000, confidence: "high" });
    const cal = buildCalendar([{ account: { id: "a", name: "Bank", mask: "1234", currency: "INR" }, forecast: f }]);
    expect(cal.lowest!.total).toBeGreaterThan(80000);
    expect(cal.belowZero).toBeNull();
    expect(cal.days[0].events[0].account.id).toBe("a");
  });

  it("names the loan and what it costs a month", () => {
    const loans = findLoans([{ currency: "INR", transactions: rows, regular }]);
    expect(loans.loans).toHaveLength(1);
    expect(loans.loans[0]).toMatchObject({ lender: "Bajaj Finance", kind: "nbfc", monthly: 9000, status: "active", count: 5 });
    expect(loans.monthly).toEqual({ INR: 9000 });
    expect(loans.income).toEqual({ INR: 60000 });
  });

  it("covers May to September without a hole", () => {
    const c = coverageOf(rows.map((t) => ({ ...t, batch: 1 })))!;
    expect(c).toMatchObject({ from: "2026-05-01", to: "2026-09-12", count: rows.length, holes: [] });
  });

  it("has no questions left to ask when everything is explained", () => {
    const checks = findChecks({
      accounts: [{ id: "a", name: "Bank", mask: "1234", currency: "INR", transactions: rows, regular }],
      person: { firstName: "Asha", lastName: "Verma" },
      incomeKind: "salaried",
      answered: [],
    });
    // The salary is the only thing worth confirming.
    expect(checks.map((c) => c.kind)).toEqual(["salary"]);
  });
});
