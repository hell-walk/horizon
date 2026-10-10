import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { readStatementRowsIsolated, runInWorker, WorkerLimitError } from "@/lib/statements/isolated";
import { readStatementRows, StatementParseError, StatementPasswordError } from "@/lib/statements/parse";

import { zipBomb } from "../../helpers/files";

const fixtures = join(__dirname, "../../fixtures/statements");
const dir = mkdtempSync(join(tmpdir(), "horizon-worker-"));
const script = (name: string, body: string) => {
  const file = join(dir, name);
  writeFileSync(file, `import { parentPort } from "node:worker_threads";\nparentPort.once("message", async (msg) => {\n${body}\n});\n`);
  return file;
};

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/build-parse-worker.mjs"], { cwd: join(__dirname, "../../..") });
});

describe("the isolation itself", () => {
  it("a job that eats memory is killed alone; the server process carries on", async () => {
    const hog = script("hog.mjs", "const keep = []; for (;;) keep.push(new Array(1e6).fill(Math.random()));");
    const before = process.memoryUsage().heapUsed;
    await expect(runInWorker(hog, {}, { memoryMb: 64, timeoutMs: 20_000 })).rejects.toBeInstanceOf(WorkerLimitError);
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(100 * 1024 * 1024);
  });

  it("a job that never ends is stopped at the time limit", async () => {
    const spin = script("spin.mjs", "for (;;) {}");
    const started = Date.now();
    await expect(runInWorker(spin, {}, { memoryMb: 64, timeoutMs: 500 })).rejects.toThrow(/took too long/);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("the worker sees no secrets from the server's environment", async () => {
    process.env.FAKE_SECRET_FOR_TEST = "should-not-leak";
    const peek = script("peek.mjs", "parentPort.postMessage(Object.keys(process.env));");
    const keys = await runInWorker<string[]>(peek, {}, { memoryMb: 64, timeoutMs: 5000 });
    delete process.env.FAKE_SECRET_FOR_TEST;
    expect(keys).toEqual(["NODE_ENV"]);
  });

  it("a crash inside the job becomes an error, not a dead server", async () => {
    const crash = script("crash.mjs", "throw new TypeError('library exploded');");
    await expect(runInWorker(crash, {}, { memoryMb: 64, timeoutMs: 5000 })).rejects.toThrow();
  });
});

describe("statements read through the worker", () => {
  it("reads a PDF statement", async () => {
    const rows = await readStatementRowsIsolated({ name: "sbi-yono.pdf", buffer: readFileSync(join(fixtures, "banks/sbi-yono.pdf")) });
    expect(rows.length).toBeGreaterThan(3);
  });

  it.each(["banks/icici.xlsx", "banks/hdfc.xls", "banks/sbi-utf16.xls", "headerless/sbi-noheader.xlsx", "pnb/pnb-binary.xls", "banks/axis.csv"])(
    "%s: the worker returns exactly what in-process reading does (dates included)",
    async (file) => {
      const buffer = readFileSync(join(fixtures, file));
      const name = file.split("/")[1];
      expect(await readStatementRowsIsolated({ name, buffer })).toEqual(await readStatementRows({ name, buffer }));
    }
  );

  it("asks for a password, and opens with the right one", async () => {
    const buffer = readFileSync(join(fixtures, "locked/sample-locked.pdf"));
    await expect(readStatementRowsIsolated({ name: "s.pdf", buffer })).rejects.toBeInstanceOf(StatementPasswordError);
    const wrong = await readStatementRowsIsolated({ name: "s.pdf", buffer, password: "nope" }).catch((e) => e);
    expect(wrong).toBeInstanceOf(StatementPasswordError);
    expect(wrong.wrongPassword).toBe(true);
    expect((await readStatementRowsIsolated({ name: "s.pdf", buffer, password: "test1234" })).length).toBeGreaterThan(3);
  });

  it("refuses a zip bomb with the usual message", async () => {
    await expect(readStatementRowsIsolated({ name: "b.xlsx", buffer: await zipBomb(40) })).rejects.toThrow(/too much data/);
  });

  it("refuses junk politely", async () => {
    await expect(readStatementRowsIsolated({ name: "x.pdf", buffer: Buffer.from("%PDF-1.4 nonsense") })).rejects.toBeInstanceOf(StatementParseError);
  });
});
