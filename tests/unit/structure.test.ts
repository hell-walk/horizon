import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Every export of a "use server" file is a public endpoint anyone can POST to.
// Keeping them in one folder keeps that surface small and reviewable.
const src = join(__dirname, "../../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
const rel = (p: string) => relative(src, p).replace(/\\/g, "/");
const directive = (text: string) => text.replace(/^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, "").match(/^["']use (server|client)["']/)?.[1];

describe("server action surface", () => {
  const all = files(src);

  it('"use server" appears only in src/lib/actions', () => {
    const outside = all.filter((p) => directive(readFileSync(p, "utf8")) === "server" && !rel(p).startsWith("lib/actions/"));
    expect(outside.map(rel)).toEqual([]);
  });

  it('"use server" files export only async functions and types', () => {
    const offenders = all
      .filter((p) => directive(readFileSync(p, "utf8")) === "server")
      .flatMap((p) =>
        readFileSync(p, "utf8")
          .split(/\r?\n/)
          .filter((line) => line.startsWith("export "))
          .filter((line) => !/^export (type |interface |async function |const \w+ = async\b)/.test(line))
          .map((line) => `${rel(p)}: ${line.slice(0, 60)}`)
      );
    expect(offenders).toEqual([]);
  });

  it("server-only modules say so", () => {
    const missing = all
      .filter((p) => rel(p).startsWith("lib/server/"))
      .filter((p) => !readFileSync(p, "utf8").includes('import "server-only"'))
      .map(rel);
    expect(missing).toEqual([]);
  });

  it("client components never import server-only modules", () => {
    const offenders = all
      .filter((p) => directive(readFileSync(p, "utf8")) === "client")
      .filter((p) => /from ["'](@\/lib\/server\/|\.\.?\/(\.\.\/)*server\/)/.test(readFileSync(p, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

// The folder layout: one bracket folder per page, holding its page, its own
// components/ and ui/. Anything two pages share lives in src/components,
// src/app/(root)/components or src/lib, never inside another page's folder.
describe("one folder per page", () => {
  const app = join(src, "app");
  const pageFolderOf = (p: string) => rel(p).match(/^app\/\((root)\)\/\(([^)]+)\)\//)?.[2] ?? rel(p).match(/^app\/\(([^)]+)\)\//)?.[1];

  it("no page imports from another page's folder", () => {
    const offenders: string[] = [];
    for (const file of files(app)) {
      const own = pageFolderOf(file);
      for (const [, spec] of readFileSync(file, "utf8").matchAll(/from ["']([^"']+)["']/g)) {
        const target = spec.startsWith("@/") ? join(src, spec.slice(2)) : spec.startsWith(".") ? join(file, "..", spec) : null;
        if (!target) continue;
        const theirs = pageFolderOf(target + "/x");
        if (theirs && own && theirs !== own) offenders.push(`${rel(file)} -> ${spec}`);
        if (theirs && !own) offenders.push(`${rel(file)} -> ${spec}`); // shared code reaching into a page
      }
    }
    for (const file of files(join(src, "components")).concat(files(join(src, "lib")))) {
      for (const [, spec] of readFileSync(file, "utf8").matchAll(/from ["']([^"']+)["']/g)) {
        if (/^@\/app\/|\(root\)|\(auth\)|\(legal\)/.test(spec)) offenders.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// The rate limiter answers with a Promise. "if (!allow(...))" on a Promise is
// always false and compiles without complaint, which would silently switch the
// limit off. Every call must wait for its answer.
describe("rate limits", () => {
  it("every limiter call is awaited", () => {
    const offenders: string[] = [];
    for (const file of files(src)) {
      if (rel(file) === "lib/server/rateLimit.ts") continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          for (const m of line.matchAll(/(^|[^\w.])(allow|isBlocked|record)\(/g)) {
            const before = line.slice(0, m.index! + m[1].length);
            if (!/await\s*$/.test(before) && !/function\s*$/.test(before)) offenders.push(`${rel(file)}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
