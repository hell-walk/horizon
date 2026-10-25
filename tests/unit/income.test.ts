import { describe, expect, it } from "vitest";

import { OWN_TRANSFER } from "@/lib/corrections";
import { creditsPerMonth, estimateIncome, findSalary } from "@/lib/income";

const credit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount, type: "credit" }) as Transaction;
// Shaped the way statement rows are stored: every amount positive, the direction in `type`.
const debit = (date: string, name: string, amount: number) => ({ id: `${date}-${name}`, date, name, amount, type: "debit" }) as Transaction;

// Four months of statements, 20 May to 10 Sept: June, July and August are the full months.
const salaried = [
  credit("2026-05-31", "NEFT/CR/INFOSYS LTD/SALARY MAY", 62000),
  debit("2026-05-20", "UPI/DR/1/SWIGGY", 400),
  credit("2026-06-30", "NEFT/CR/INFOSYS LTD/SALARY JUN", 62000),
  credit("2026-06-15", "UPI/CR/2/RAMESH KUMAR/SBIN/r@oksbi", 2000),
  credit("2026-07-31", "NEFT/CR/INFOSYS LTD/SALARY JUL", 64000),
  credit("2026-07-05", "IMPS REFUND AMAZON", 1200),
  credit("2026-08-31", "NEFT/CR/INFOSYS LTD/SALARY AUG", 62000),
  { ...credit("2026-08-10", "IMPS SELF", 10000), userCategory: OWN_TRANSFER } as Transaction,
  debit("2026-09-10", "UPI/DR/3/ZOMATO", 600),
];

describe("findSalary: a company paying much the same each month", () => {
  it("finds the employer and its usual amount", () => {
    // The narration says SALARY, from a company, by NEFT, every month: Horizon can be sure.
    expect(findSalary(salaried)).toEqual({ payee: "Infosys", monthly: 62000, months: 4, last: "2026-08-31", confidence: "high" });
  });

  it("takes the person's word: a confirmed payer is the salary, a denied one never is", () => {
    expect(findSalary(salaried, { exclude: ["Infosys"] })).toBeUndefined();
    const uneven = [credit("2026-06-30", "NEFT/CR/ACME TRADERS/", 40000), credit("2026-07-31", "NEFT/CR/ACME TRADERS/", 90000)];
    expect(findSalary(uneven)).toBeUndefined();
    expect(findSalary(uneven, { prefer: "Acme Traders" })).toMatchObject({ payee: "Acme Traders", months: 2 });
  });

  it("is not fooled by a person who sends money every month", () => {
    const rows = [credit("2026-06-01", "UPI/CR/1/RAMESH KUMAR/SBIN/r@oksbi", 5000), credit("2026-07-01", "UPI/CR/2/RAMESH KUMAR/SBIN/r@oksbi", 5000)];
    expect(findSalary(rows)).toBeUndefined();
  });

  it("needs a steady amount in two different months", () => {
    expect(findSalary([credit("2026-06-01", "NEFT/CR/ACME TRADERS/", 50000), credit("2026-06-20", "NEFT/CR/ACME TRADERS/", 50000)])).toBeUndefined();
    expect(findSalary([credit("2026-06-01", "NEFT/CR/ACME TRADERS/", 50000), credit("2026-07-01", "NEFT/CR/ACME TRADERS/", 20000)])).toBeUndefined();
  });

  it("prefers a payer whose narration says salary over a bigger one that does not", () => {
    const rows = [
      credit("2026-06-01", "NEFT/CR/ACME TRADERS/", 90000),
      credit("2026-07-01", "NEFT/CR/ACME TRADERS/", 90000),
      credit("2026-06-01", "NEFT/CR/INFOSYS LTD/SALARY", 60000),
      credit("2026-07-01", "NEFT/CR/INFOSYS LTD/SALARY", 60000),
    ];
    expect(findSalary(rows)?.payee).toBe("Infosys");
  });
});

describe("creditsPerMonth: money in over the full months", () => {
  it("leaves out the part months at both ends, own transfers and refunds", () => {
    // June 62000 + 2000, July 64000 (refund left out), August 62000 (own transfer left out) = 190000 over 3 months.
    expect(creditsPerMonth(salaried)).toEqual({ monthly: 63333.33, months: 3 });
  });

  it("uses every month when there are fewer than three", () => {
    expect(creditsPerMonth([credit("2026-06-10", "UPI/CR/1/MOM/SBIN/m@oksbi", 3000), credit("2026-07-10", "UPI/CR/2/MOM/SBIN/m@oksbi", 3000)])).toEqual({
      monthly: 3000,
      months: 2,
    });
  });
});

describe("estimateIncome: read the way the person earns", () => {
  it("salaried: the salary credit", () => {
    const e = estimateIncome(salaried, "salaried");
    expect(e).toMatchObject({ kind: "salaried", monthly: 62000, source: "salary", creditsMonthly: 63333.33, months: 3 });
  });

  it("salaried with a side income the person named: the salary plus that figure", () => {
    const e = estimateIncome(salaried, "salaried", undefined, {}, 15000);
    expect(e).toMatchObject({ monthly: 77000, source: "salary", side: 15000 });
    expect(e.salary?.monthly).toBe(62000);
  });

  it("salaried without a salary credit yet: money in, and says so", () => {
    const e = estimateIncome([credit("2026-06-10", "UPI/CR/1/RAMESH KUMAR/SBIN/r@oksbi", 3000)], "salaried");
    expect(e).toMatchObject({ monthly: 3000, source: "credits" });
    expect(e.salary).toBeUndefined();
  });

  it("student: pocket money is money in, never salary", () => {
    const e = estimateIncome(salaried, "student");
    expect(e).toMatchObject({ kind: "student", monthly: 63333.33, source: "credits" });
    expect(e.salary).toBeUndefined();
  });

  it("freelancer: the figure given, checked against the statements", () => {
    expect(estimateIncome(salaried, "freelancer", 60000)).toMatchObject({ monthly: 60000, source: "declared", mismatch: false });
    expect(estimateIncome(salaried, "freelancer", 150000)).toMatchObject({ monthly: 150000, source: "declared", mismatch: true });
    expect(estimateIncome(salaried, "freelancer")).toMatchObject({ monthly: 63333.33, source: "credits" });
  });

  it("nothing to go on: no figure", () => {
    expect(estimateIncome([], "none")).toMatchObject({ monthly: null, source: "none", months: 0 });
  });
});

describe("money going out is never money in (rows as statements store them: positive amounts, direction in type)", () => {
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  const every = (name: string, amount: number, day: number, make: typeof credit) =>
    months.map((m) => make(`${m}-${String(day).padStart(2, "0")}`, name, amount));
  const spendingOnly = [
    ...every("NETFLIX.COM", 649, 6, debit),
    ...every("ACH/DR/BAJAJ FINANCE LTD/EMI", 4800, 5, debit),
    ...every("UPI/DR/3/SURESH GUPTA/SBIN/rent", 12000, 2, debit),
    ...every("UPI/DR/4/JIO PREP/YESB/", 349, 12, debit),
  ];

  it("a steady subscription, EMI or rent paid out is never taken for a salary", () => {
    expect(findSalary(spendingOnly)).toBeUndefined();
  });

  it("the real salary is found among steady payments out, not the biggest of them", () => {
    const rows = [...spendingOnly, ...every("NEFT/CR/ACME TECHNOLOGIES PVT LTD", 9000, 28, credit)];
    expect(findSalary(rows)).toMatchObject({ payee: expect.stringMatching(/acme/i), monthly: 9000, months: 5 });
  });

  it("money in counts credits only", () => {
    const pocket = every("UPI/CR/1/RAJESH SHARMA/SBIN/r@oksbi", 8000, 1, credit);
    // Five months: June, July and August are the full ones; 8,000 a month in, whatever went out.
    expect(creditsPerMonth([...spendingOnly, ...pocket])).toEqual({ monthly: 8000, months: 3 });
    expect(estimateIncome([...spendingOnly, ...pocket], "student")).toMatchObject({ monthly: 8000, source: "credits" });
  });

  it("a row with no type still goes by its sign", () => {
    const untyped = [
      { id: "u1", date: "2026-06-30", name: "NEFT/CR/ACME TECHNOLOGIES PVT LTD", amount: 9000 },
      { id: "u2", date: "2026-07-31", name: "NEFT/CR/ACME TECHNOLOGIES PVT LTD", amount: 9000 },
    ] as Transaction[];
    expect(findSalary(untyped)).toMatchObject({ monthly: 9000 });
  });
});
