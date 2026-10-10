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
