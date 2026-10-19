import { describe, expect, it } from "vitest";

import { OWN_TRANSFER } from "@/lib/corrections";
import { findRegular } from "@/lib/recurring";
import { monthlyReport, reportMonths } from "@/lib/report";

const credit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount, type: "credit" }) as Transaction;
const debit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount: -amount, type: "debit" }) as Transaction;

const rows = [
  credit("2026-05-31", "NEFT/CR/INFOSYS LTD/SALARY", 60000),
  ...["06", "07", "08"].flatMap((m) => [
    credit(`2026-${m}-30`, "NEFT/CR/INFOSYS LTD/SALARY", 60000),
    debit(`2026-${m}-05`, "ACH D- BAJAJ FINANCE LTD-EMI", 9000),
    debit(`2026-${m}-02`, "UPI/DR/2/RENT HOUSE OWNER/rent", 15000),
    debit(`2026-${m}-12`, "UPI/DR/3/SWIGGY", 6000),
    debit(`2026-${m}-15`, "UPI/DR/4/ZERODHA SIP", 10000),
  ]),
  debit("2026-08-20", "SMS CHGS 01-04-26TO30-06-26", 17.7),
  credit("2026-08-22", "IMPS REFUND AMAZON", 1200),
  { ...debit("2026-08-25", "IMPS SELF", 5000), userCategory: OWN_TRANSFER } as Transaction,
  debit("2026-09-03", "UPI/DR/5/SWIGGY", 500),
];
const regular = findRegular(rows, new Date("2026-09-10T00:00:00Z"));

describe("monthlyReport: one month, summed", () => {
  it("lists the full months, newest first", () => {
    expect(reportMonths(rows)).toEqual(["2026-08", "2026-07", "2026-06"]);
  });

  it("adds up August: in, out, kept, where it went, the biggest, EMIs and charges", () => {
    const r = monthlyReport(rows, regular, "2026-08")!;
    expect(r.moneyIn).toBe(60000); // the refund is not income
    expect(r.spent).toBe(30017.7); // the SIP is kept, the own transfer is neither
    expect(r.invested).toBe(10000);
    expect(r.kept).toBe(29982.3);
    expect(r.keptRate).toBeCloseTo(0.4997, 3);
    expect(r.byType[0]).toMatchObject({ name: "Rent", amount: 15000 });
    expect(r.biggest[0]).toMatchObject({ name: "Rent", amount: 15000, type: "Rent" });
    expect(r.emis).toEqual({ amount: 9000, count: 1 });
    expect(r.charges).toEqual({ amount: 17.7, count: 1 });
  });

  it("says what is due the month after", () => {
    const r = monthlyReport(rows, regular, "2026-08")!;
    expect(r.nextMonth.map((d) => d.date.slice(0, 7))).toEqual(r.nextMonth.map(() => "2026-09"));
    expect(r.nextMonth.some((d) => d.kind === "emi" && d.amount === -9000)).toBe(true);
    expect(r.nextMonth.some((d) => d.kind === "income" && d.amount === 60000)).toBe(true);
  });

  it("is null for a month with nothing in it", () => {
    expect(monthlyReport(rows, regular, "2025-01")).toBeNull();
  });
});
