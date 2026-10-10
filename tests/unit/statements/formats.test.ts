import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseStatement, StatementPasswordError } from "@/lib/statements/parse";

const fixtures = join(__dirname, "../../fixtures/statements");
const read = (...p: string[]) => readFileSync(join(fixtures, ...p));
const simple = (t: { date: string; type: string; amount: number }) => ({ date: t.date, type: t.type, amount: t.amount });

describe("bank export formats", () => {
  // Twelve layouts (CSV, binary XLS, UTF-16 XLS, XLSX, PDF) of the same three payments.
  const files = readdirSync(join(fixtures, "banks")).sort();

  it.each(files)("%s reads the same three payments", async (file) => {
    const parsed = await parseStatement({ name: file, buffer: read("banks", file) });
    expect(parsed.transactions.map(simple)).toEqual([
      { date: "2024-04-01", type: "debit", amount: 640 },
      { date: "2024-04-03", type: "credit", amount: 45000 },
      { date: "2024-04-05", type: "debit", amount: 5000 },
    ]);
    expect(parsed.closingBalance).toBe(164360);
    expect(parsed.check.status).toBe("ok");
  });
});

describe("statements without a usable header row", () => {
  const files = readdirSync(join(fixtures, "headerless")).sort();

  it.each(files)("%s: columns inferred from the data", async (file) => {
    const parsed = await parseStatement({ name: file, buffer: read("headerless", file) });
    expect(parsed.transactions.map(simple)).toEqual([
      { date: "2026-06-06", type: "credit", amount: 1 },
      { date: "2026-06-07", type: "debit", amount: 500 },
      { date: "2026-06-08", type: "credit", amount: 10000 },
      { date: "2026-06-09", type: "debit", amount: 1250.5 },
    ]);
    expect(parsed.check.status).toBe("ok");
  });
});

describe("PNB .xls exports (binary, HTML and tab-separated under one extension)", () => {
  it.each(["pnb-binary.xls", "pnb-html.xls", "pnb-tsv.xls"])("%s", async (file) => {
    const parsed = await parseStatement({ name: file, buffer: read("pnb", file) });
    expect(parsed.transactions.map((t) => `${t.date} ${t.type} ${t.amount}`)).toEqual([
      "2025-11-02 debit 620",
      "2025-11-04 credit 145000",
      "2025-11-06 debit 5000",
      "2025-11-08 debit 28000",
    ]);
    expect(parsed.institutionName).toBe("Punjab National Bank");
    expect(parsed.accountMask).toBe("4821");
    expect(parsed.closingBalance).toBe(157210);
  });
});

describe("password-protected statements", () => {
  it.each([
    ["sample-locked.xlsx", "Excel"],
    ["sample-locked.pdf", "PDF"],
  ])("%s asks for a password, rejects a wrong one and opens with the right one", async (file) => {
    const buffer = read("locked", file);

    const missing = await parseStatement({ name: file, buffer }).catch((e) => e);
    expect(missing).toBeInstanceOf(StatementPasswordError);
    expect(missing.wrongPassword).toBe(false);

    const wrong = await parseStatement({ name: file, buffer, password: "nope" }).catch((e) => e);
    expect(wrong).toBeInstanceOf(StatementPasswordError);
    expect(wrong.wrongPassword).toBe(true);

    const parsed = await parseStatement({ name: file, buffer, password: "test1234" });
    expect(parsed.transactions).toHaveLength(5);
    expect(parsed.institutionName).toBe("HDFC Bank");
  });
});
