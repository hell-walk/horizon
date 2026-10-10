import { describe, expect, it } from "vitest";

import { buildStatement, detectCurrency, detectDateOrder, parseAmount, parseDate, type Cell } from "@/lib/statements/parse";
import { formatAmount } from "@/lib/utils";

const rows = (text: string): Cell[][] => text.trim().split("\n").map((line) => line.split(";"));

describe("dates written either way", () => {
  it("reads numeric dates day first or month first", () => {
    expect(parseDate("03/04/2026")).toBe("2026-04-03");
    expect(parseDate("03/04/2026", "mdy")).toBe("2026-03-04");
    expect(parseDate("10/25/2026", "mdy")).toBe("2026-10-25");
    expect(parseDate("10/25/2026")).toBeNull(); // no 25th month
  });

  it("reads US dates with the month written out", () => {
    expect(parseDate("Oct 5, 2026")).toBe("2026-10-05");
    expect(parseDate("October 25 2026")).toBe("2026-10-25");
    expect(parseDate("Sep. 3rd, 2026")).toBe("2026-09-03");
  });

  it("works the order out from the file", () => {
    expect(detectDateOrder(["25/09/2026", "03/10/2026"])).toEqual({ order: "dmy", sure: true, numeric: true });
    expect(detectDateOrder(["09/25/2026", "10/03/2026"])).toEqual({ order: "mdy", sure: true, numeric: true });
    // Every number 12 or less: the reading that keeps the rows in order wins.
    // Month first: Jan 12, Feb 1, Mar 2 (in order); day first would be 1 Dec, 2 Jan, 3 Feb (not).
    expect(detectDateOrder(["01/12/2026", "02/01/2026", "03/02/2026"])).toMatchObject({ order: "mdy", sure: true });
    // Day first: 12 Jan, 1 Feb, 2 Mar (in order); month first would be Dec 1, Jan 2, Feb 3 (not).
    expect(detectDateOrder(["12/01/2026", "01/02/2026", "02/03/2026"])).toMatchObject({ order: "dmy", sure: true });
    // In order either way (2, 3, 4 Jan or Feb 1, Mar 1, Apr 1): a guess, and said so.
    expect(detectDateOrder(["02/01/2026", "03/01/2026", "04/01/2026"], "dmy")).toMatchObject({ order: "dmy", sure: false });
    // Truly can't tell: the hint, marked as a guess.
    expect(detectDateOrder(["05/05/2026"], "mdy")).toEqual({ order: "mdy", sure: false, numeric: true });
    expect(detectDateOrder(["Oct 5, 2026", "Oct 7, 2026"])).toMatchObject({ numeric: false });
  });
});

describe("statements from other countries", () => {
  it("keeps every row of a US statement (it used to drop days after the 12th)", () => {
    const us = rows(`
Chase Checking;;;;
Date;Description;Debit;Credit;Balance
09/28/2026;WALMART SUPERCENTER;54.20;;1945.80
10/01/2026;PAYROLL ACME INC;;2500.00;4445.80
10/15/2026;COMCAST CABLE;89.99;;4355.81
`);
    const parsed = buildStatement(us, "chase.csv");
    expect(parsed.transactions.map((t) => t.date)).toEqual(["2026-09-28", "2026-10-01", "2026-10-15"]);
    expect(parsed.dateOrder).toEqual({ order: "mdy", sure: true, numeric: true });
    expect(parsed.check.status).toBe("ok");
  });

  it("reads a European statement: day first, decimal comma, euros", () => {
    const de = rows(`
Kontoauszug EUR;;;;
Datum;Buchungstext;Soll;Haben;Saldo
02.10.2026;REWE MARKT;45,90;;1.954,10
15.10.2026;GEHALT;;2.500,00;4.454,10
`);
    const parsed = buildStatement(de, "konto.csv");
    expect(parsed.currency).toBe("EUR");
    expect(parsed.transactions.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-02", 45.9],
      ["2026-10-15", 2500],
    ]);
    expect(parsed.closingBalance).toBe(4454.1);
  });

  it("finds French, Spanish and Italian headings, accents and all", () => {
    for (const header of ["Date opération;Libellé;Débit;Crédit;Solde", "Fecha;Concepto;Cargo;Abono;Saldo", "Data;Descrizione;Addebiti;Accrediti;Saldo"]) {
      const parsed = buildStatement(rows(`${header}
02/10/2026;CARREFOUR;45,90;;1954,10
15/10/2026;SALAIRE;;2500,00;4454,10`), "x.csv");
      expect(parsed.transactions.map((t) => [t.date, t.amount, t.type]), header).toEqual([
        ["2026-10-02", 45.9, "debit"],
        ["2026-10-15", 2500, "credit"],
      ]);
    }
  });

  it("lets the user choose the order when the file cannot tell", () => {
    const vague = rows(`
Date;Description;Debit;Credit;Balance
05/05/2026;SHOP;10.00;;90.00
`);
    expect(buildStatement(vague, "x.csv").dateOrder).toMatchObject({ order: "dmy", sure: false });
    const chosen = buildStatement(vague, "x.csv", undefined, { dateOrder: "mdy" });
    expect(chosen.dateOrder).toMatchObject({ order: "mdy", sure: true });
  });
});

describe("currencies", () => {
  it("finds the currency a statement uses", () => {
    expect(detectCurrency("Amount (₹) Balance")).toBe("INR");
    expect(detectCurrency("Rs. 500 debited")).toBe("INR");
    expect(detectCurrency("Balance $1,200.00")).toBe("USD");
    expect(detectCurrency("Saldo €")).toBe("EUR");
    expect(detectCurrency("Statement in GBP £")).toBe("GBP");
    expect(detectCurrency("Balance S$1,200")).toBe("SGD");
    expect(detectCurrency("AED account")).toBe("AED");
    expect(detectCurrency("Narration Debit Credit")).toBe("INR"); // names none
  });

  it("writes each currency the local way", () => {
    expect(formatAmount(124560.5, "INR")).toBe("₹1,24,560.50");
    expect(formatAmount(124560.5, "USD")).toBe("$124,560.50");
    expect(formatAmount(124560.5, "EUR")).toMatch(/^124\.560,50\s€$/);
    expect(formatAmount(1500, "JPY")).toMatch(/1,500$/);
  });

  it("reads European and Indian number styles", () => {
    expect(parseAmount("1.234,56").value).toBe(1234.56);
    expect(parseAmount("1,23,456.78").value).toBe(123456.78);
  });
});
