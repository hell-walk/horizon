import { describe, expect, it } from "vitest";

import { checkZip, LIMITS } from "@/lib/statements/limits";
import { readStatementRows, StatementParseError } from "@/lib/statements/parse";

import { csvStatement, longPdf, makePdf, zipBomb } from "../../helpers/files";

const read = (name: string, buffer: Buffer) => readStatementRows({ name, buffer });

describe("work limits on uploaded statements", () => {
  it("rejects a zip bomb before unpacking it", async () => {
    const bomb = await zipBomb(200);
    expect(bomb.length).toBeLessThan(1024 * 1024); // small on disk
    await read("bomb.xlsx", bomb).catch(() => {}); // warm-up: the first call loads the Excel libraries
    const heap = process.memoryUsage().heapUsed;
    const started = performance.now();
    await expect(read("bomb.xlsx", bomb)).rejects.toThrow(/unpacks to too much data/);
    expect(performance.now() - started).toBeLessThan(200);
    expect(process.memoryUsage().heapUsed - heap).toBeLessThan(50 * 1024 * 1024);
  });

  it("rejects a PDF with more pages than allowed", async () => {
    await expect(read("long.pdf", longPdf(LIMITS.pdfPages + 1))).rejects.toThrow(new RegExp(`${LIMITS.pdfPages + 1} pages`));
  });

  it("reads a PDF just under the page limit", async () => {
    const rows = await read("ok.pdf", makePdf([["Date Narration Debit Credit Balance", "01/04/2024 UPI 10.00 990.00"]]));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("rejects a statement with too many rows", async () => {
    await expect(read("many.csv", csvStatement(LIMITS.rows + 10))).rejects.toBeInstanceOf(StatementParseError);
  });

  it("reads a normal statement", async () => {
    expect(await read("ok.csv", csvStatement(100))).toHaveLength(101);
  });

  it("rejects a damaged zip instead of crashing", () => {
    expect(() => checkZip(Buffer.from("PK\u0003\u0004 not really a zip"))).toThrow(/damaged/);
  });

  it("refuses files it does not understand", async () => {
    await expect(read("x.exe", Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))).rejects.toBeInstanceOf(StatementParseError);
  });
});
