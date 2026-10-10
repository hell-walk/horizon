import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseStatement, StatementParseError, StatementPasswordError } from "@/lib/statements/parse";

// Mutation fuzzing: every real fixture, damaged in many seeded ways. Reading a
// damaged file may succeed or fail, but it must fail politely (the parser's own
// errors, which the app turns into a message) and quickly. Anything else, a
// TypeError from deep inside a library or a hang, is a bug.

const fixtures = join(__dirname, "../../fixtures/statements");
const files = ["banks", "headerless", "pnb"].flatMap((dir) =>
  readdirSync(join(fixtures, dir)).map((name) => ({ name, buffer: readFileSync(join(fixtures, dir, name)) }))
);

// Small deterministic PRNG (mulberry32), so a failure can be replayed by seed.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mutate(input: Buffer, seed: number): Buffer {
  const random = rng(seed);
  const int = (n: number) => Math.floor(random() * n);
  let out = Buffer.from(input);
  const rounds = 1 + int(4);
  for (let r = 0; r < rounds; r++) {
    switch (int(6)) {
      case 0: // flip some bytes
        for (let i = 0; i < 1 + int(20); i++) out[int(out.length)] ^= 1 << int(8);
        break;
      case 1: // cut it short
        out = out.subarray(0, int(out.length));
        break;
      case 2: // insert junk
        {
          const at = int(out.length);
          const junk = Buffer.from(Array.from({ length: 1 + int(200) }, () => int(256)));
          out = Buffer.concat([out.subarray(0, at), junk, out.subarray(at)]);
        }
        break;
      case 3: // repeat a chunk
        {
          const from = int(out.length);
          const chunk = out.subarray(from, from + 1 + int(500));
          out = Buffer.concat([out, chunk, chunk, chunk]);
        }
        break;
      case 4: // overwrite with structure characters
        for (let i = 0; i < 1 + int(30); i++) out[int(out.length)] = ',;|\t"\n\r<>()-'.charCodeAt(int(14));
        break;
      default: // drop a slice from the middle
        {
          const a = int(out.length);
          const b = a + int(Math.max(1, out.length - a));
          out = Buffer.concat([out.subarray(0, a), out.subarray(b)]);
        }
    }
  }
  return out;
}

const PER_FILE = 100; // about 2,000 damaged files per run

describe("statement parser under mutation fuzzing", () => {
  it.each(files.map((f) => [f.name, f] as const))("%s: damaged copies fail politely and quickly", async (_name, file) => {
    const failures: string[] = [];
    for (let i = 0; i < PER_FILE; i++) {
      const seed = file.buffer.length * 1000 + i;
      const buffer = mutate(file.buffer, seed);
      const started = performance.now();
      try {
        await parseStatement({ name: file.name, buffer });
      } catch (error) {
        if (!(error instanceof StatementParseError || error instanceof StatementPasswordError)) {
          failures.push(`seed ${seed}: ${(error as Error)?.constructor?.name} ${(error as Error)?.message?.slice(0, 120)}`);
        }
      }
      const ms = performance.now() - started;
      if (ms > 5000) failures.push(`seed ${seed}: took ${Math.round(ms)} ms`);
    }
    expect(failures).toEqual([]);
  });

  it("pure noise of many sizes is refused politely", async () => {
    const random = rng(42);
    for (const size of [0, 1, 3, 4, 16, 512, 4096, 65536]) {
      for (const name of ["x.csv", "x.xls", "x.xlsx", "x.pdf", "x"]) {
        const buffer = Buffer.from(Array.from({ length: size }, () => Math.floor(random() * 256)));
        const error = await parseStatement({ name, buffer }).then(() => null, (e) => e);
        if (error) expect(error, `${name} ${size}`).toBeInstanceOf(StatementParseError);
      }
    }
  });

  it("files that claim one format and are another are handled", async () => {
    const pdfHead = Buffer.from("%PDF-1.4\n%garbage after the header");
    const zipHead = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00]);
    const oleHead = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0]);
    for (const [buffer, name] of [[pdfHead, "a.csv"], [zipHead, "a.pdf"], [oleHead, "a.xlsx"], [Buffer.from("<html><table><tr><td>"), "a.xls"]] as const) {
      const error = await parseStatement({ name, buffer }).then(() => null, (e) => e);
      if (error) expect(error, name).toSatisfy((e: unknown) => e instanceof StatementParseError || e instanceof StatementPasswordError);
    }
  });
});
