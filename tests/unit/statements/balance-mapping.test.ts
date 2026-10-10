import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildStatement,
  checkBalances,
  cleanMapping,
  mappingProblem,
  parseStatement,
  readStatementRows,
  sampleStatement,
  StatementLayoutError,
} from "@/lib/statements/parse";

describe("balance check", () => {
  it("passes a statement whose running balances add up", async () => {
    const parsed = await parseStatement({
      name: "ok.csv",
      buffer: Buffer.from("Date,Narration,Debit,Credit,Balance\n01/04/2024,UPI SWIGGY,640.00,,1000.00\n02/04/2024,NEFT SALARY,,5000.00,6000.00\n"),
    });
    expect(parsed.check).toMatchObject({ status: "ok", checked: 1, opening: 1640, closing: 6000, totalIn: 5000, totalOut: 640 });
  });

  it("points at the row that does not add up", async () => {
    const buffer = readFileSync(join(__dirname, "../../fixtures/statements/broken.csv"));
    const { check } = await parseStatement({ name: "broken.csv", buffer });
    expect(check.status).toBe("mismatch");
    expect(check.mismatches).toEqual([{ date: "2024-04-03", name: "ATM WDL", expected: 5500, actual: 5000 }]);
  });

  it("says when there is no running balance to check", () => {
    const check = checkBalances([{ date: "2024-04-01", name: "x", amount: 10, type: "debit" }]);
    expect(check.status).toBe("unchecked");
    expect(check.totalOut).toBe(10);
  });

  it("orders newest-first statements oldest-first, keeping same-day order", async () => {
    const csv = [
      "Date,Narration,Debit,Credit,Balance",
      "03/04/2024,THIRD,,10.00,130.00",
      "03/04/2024,SECOND,,20.00,120.00",
      "01/04/2024,FIRST,,100.00,100.00",
    ].join("\n");
    const parsed = await parseStatement({ name: "n.csv", buffer: Buffer.from(csv) });
    expect(parsed.transactions.map((t) => t.name)).toEqual(["FIRST", "SECOND", "THIRD"]);
    expect(parsed.closingBalance).toBe(130);
    expect(parsed.check.status).toBe("ok");
  });
});

// Headers Horizon does not know and amounts with no paise defeat automatic detection.
const oddFile = (rows: string[]) => Buffer.from(["Kontoauszug", "Buchung;Vorgang;Ref;Betrag;Saldo", ...rows].join("\n"));
const april = oddFile([
  "01.04.2024;Swiggy order;R1;-640;1000",
  "02.04.2024;Salary;R2;5000;6000",
  "03.04.2024;ATM;R3;-500;5500",
  "05.04.2024;Zomato;R4;-200;5300",
]);
const may = oddFile(["01.05.2024;Rent;R9;-2000;3300", "04.05.2024;Refund;R10;150;3450"]);
const mapping = { date: 0, name: 1, reference: 2, amount: 3, balance: 4 };

describe("column mapping", () => {
  it("throws a layout error for a file it cannot read on its own", async () => {
    const rows = await readStatementRows({ name: "a.csv", buffer: april });
    expect(() => buildStatement(rows, "a.csv")).toThrow(StatementLayoutError);
  });

  it("samples the rows, the header labels and a guess to start from", async () => {
    const sample = sampleStatement(await readStatementRows({ name: "a.csv", buffer: april }));
    expect(sample.width).toBe(5);
    expect(sample.rows).toHaveLength(4);
    expect(sample.rows[0]).toEqual(["01.04.2024", "Swiggy order", "R1", "-640", "1000"]);
    expect(sample.labels).toEqual(["Buchung", "Vorgang", "Ref", "Betrag", "Saldo"]);
    expect(sample.guess).toMatchObject({ date: 0, name: 1, balance: 4 });
  });

  it("gives two months of the same layout the same fingerprint", async () => {
    const a = sampleStatement(await readStatementRows({ name: "a.csv", buffer: april }));
    const b = sampleStatement(await readStatementRows({ name: "b.csv", buffer: may }));
    expect(a.signature).toBe(b.signature);
  });

  it("reads the file with the user's mapping, and the balances add up", async () => {
    const parsed = buildStatement(await readStatementRows({ name: "a.csv", buffer: april }), "a.csv", mapping);
    expect(parsed.transactions.map((t) => `${t.type} ${t.amount}`)).toEqual(["debit 640", "credit 5000", "debit 500", "debit 200"]);
    expect(parsed.check.status).toBe("ok");
    expect(parsed.columns).toEqual(mapping);
  });

  it("signs an unsigned amount column from the running balance", async () => {
    const unsigned = Buffer.from(april.toString().replace(/;-/g, ";"));
    const parsed = buildStatement(await readStatementRows({ name: "u.csv", buffer: unsigned }), "u.csv", mapping);
    // The first row has no balance before it, so only rows 2-4 can be signed.
    expect(parsed.transactions.slice(1).map((t) => t.type)).toEqual(["credit", "debit", "debit"]);
  });

  it("cleanMapping keeps only known roles as own properties", () => {
    const dirty = Object.assign(Object.create({ date: 9 }), { name: 1, amount: 3, extra: 4 });
    expect(cleanMapping(dirty)).toEqual({ name: 1, amount: 3 });
    expect(Object.getPrototypeOf(cleanMapping({ date: 0 }))).toBe(Object.prototype);
  });

  describe("mappingProblem (server-side validation of what the browser sends)", () => {
    it.each([
      [{ date: 0, name: 1, amount: 3 }, null],
      [{ date: 0, name: 1, debit: 3 }, null],
      [{ date: 0, name: 0, amount: 3 }, "Each column can only have one role."],
      [{ date: 0, name: 1 }, "Choose the money out and money in columns, or a single amount column."],
      [{ date: 0, name: 1, amount: 9 }, "A chosen column is not in the file."],
      [{ date: 0, name: 1, amount: -1 }, "A chosen column is not in the file."],
      [{ date: 0, name: 1, amount: 1.5 }, "A chosen column is not in the file."],
      [{ date: 0, name: 1, amount: "3" }, "A chosen column is not in the file."],
      [{ date: 0, name: 1, amount: 3, evil: 2 }, 'Unknown column role "evil".'],
      [{ __proto__: { date: 0 }, name: 1, amount: 3 }, "Choose the date column."], // inherited, not chosen
      [JSON.parse('{"__proto__":{"date":0},"name":1,"amount":3}'), 'Unknown column role "__proto__".'],
      [[0, 1, 3], "Pick the columns first."],
      [null, "Pick the columns first."],
      ["date", "Pick the columns first."],
    ])("%j -> %s", (value, expected) => {
      expect(mappingProblem(value, 5)).toBe(expected);
    });
  });
});
