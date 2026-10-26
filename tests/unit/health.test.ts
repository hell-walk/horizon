import { describe, expect, it } from "vitest";

import { healthScore } from "@/lib/finance/health";
import { findRegular } from "@/lib/finance/recurring";

const credit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount, type: "credit" }) as Transaction;
const debit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount: -amount, type: "debit" }) as Transaction;

// May to September: June, July and August are the full months. Salary 60000, EMI 9000, rent 15000, food, one SMS charge.
const months = ["06", "07", "08"];
const rows = [
  credit("2026-05-31", "NEFT/CR/INFOSYS LTD/SALARY", 60000),
  debit("2026-05-20", "UPI/DR/1/SWIGGY", 400),
  ...months.flatMap((m) => [
    credit(`2026-${m}-30`, "NEFT/CR/INFOSYS LTD/SALARY", 60000),
    debit(`2026-${m}-05`, "ACH D- BAJAJ FINANCE LTD-EMI", 9000),
    debit(`2026-${m}-02`, "UPI/DR/2/RENT HOUSE OWNER/rent", 15000),
    debit(`2026-${m}-12`, "UPI/DR/3/SWIGGY", 6000),
    debit(`2026-${m}-15`, "UPI/DR/4/ZERODHA SIP", 10000),
  ]),
  debit("2026-07-20", "SMS CHGS 01-04-26TO30-06-26", 17.7),
  debit("2026-09-03", "UPI/DR/5/SWIGGY", 500),
];
const today = new Date("2026-09-10T00:00:00Z");

describe("healthScore: five explained parts", () => {
  it("adds up over the full months, investments counted as kept", () => {
    const h = healthScore({ transactions: rows, regular: findRegular(rows, today), income: 60000, balance: 90000 });
    expect(h.months).toBe(3);
    const part = (key: string) => h.parts.find((p) => p.key === key)!;
    // Spent 30000 of 60000 a month (the SIP is not spending): half kept, full marks.
    expect(part("savings").points).toBe(30);
    expect(part("savings").value).toBeCloseTo(0.5, 2); // the SMS charge shaves a little off
    // EMI 9000 of 60000 = 15%: full marks.
    expect(part("emi")).toMatchObject({ points: 25, value: 0.15 });
    // EMI + rent = 24000 of 60000 = 40%: full marks.
    expect(part("commitments").points).toBe(15);
    // One charge in three months.
    expect(part("charges")).toMatchObject({ points: 7, value: 1 });
    // 90000 covers three months of 30000: full marks.
    expect(part("cushion").points).toBe(20);
    expect(part("cushion").value).toBeCloseTo(3, 2);
    expect(h.score).toBe(97);
    expect(h.band).toBe("good");
    expect(h.opportunity).toBe("charges");
  });

  it("scales to what is known when the income is not, and names the biggest gap", () => {
    const h = healthScore({ transactions: rows, regular: findRegular(rows, today), income: null, balance: 10000 });
    // Money in is known from the statements, so savings still counts; EMI and commitments use it too.
    expect(h.parts.find((p) => p.key === "emi")!.points).toBe(25);
    // 10000 covers a third of a month: little cushion.
    expect(h.parts.find((p) => p.key === "cushion")).toMatchObject({ points: 2 });
    expect(h.opportunity).toBe("cushion");
    expect(h.band).toBe("good");
  });

  it("withholds the score when too little is known", () => {
    const h = healthScore({ transactions: [debit("2026-08-01", "UPI/DR/1/SWIGGY", 300)], regular: [], income: null, balance: null });
    expect(h.score).toBeNull();
    expect(h.band).toBeNull();
    expect(h.parts.every((p) => p.key === "charges" || p.points === null)).toBe(true);
  });

  it("a heavy EMI load scores low on that part", () => {
    const heavy = rows.map((r) => (r.name.includes("BAJAJ") ? { ...r, amount: -30000 } : r));
    const h = healthScore({ transactions: heavy, regular: findRegular(heavy, today), income: 60000, balance: 90000 });
    // 30000 of 60000 = 50%: beyond two fifths, no points.
    expect(h.parts.find((p) => p.key === "emi")).toMatchObject({ points: 0 });
    expect(h.opportunity).toBe("emi");
  });
});
