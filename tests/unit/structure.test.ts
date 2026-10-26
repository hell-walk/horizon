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
          .map((line) => `${rel(p)}: ${line.slice(0, 60)}`),
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

  it("a page reaches its own components by a short relative path, never through @/app", () => {
    const offenders = files(src).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/from ["'](@\/app\/[^"']+)["']/g)].map((m) => `${rel(file)} -> ${m[1]}`),
    );
    expect(offenders).toEqual([]);
  });

  // Next.js's own files (a page, its layout, loading screen, an API route, the
  // site's icons and metadata) sit where the address needs them; everything
  // else in app/ is a component, in its page's components/ or ui/ folder.
  const NEXT_FILES =
    /^(page|layout|loading|error|global-error|not-found|route|template|default|manifest|robots|sitemap|opengraph-image|icon|apple-icon)\.tsx?$/;

  it("components sit in a components/ or ui/ folder, not loose beside a page", () => {
    const loose = files(app)
      .map(rel)
      .filter((p) => !NEXT_FILES.test(p.split("/").pop()!))
      .filter((p) => !/\/(components|ui)\/[^/]+$/.test(p));
    expect(loose).toEqual([]);
  });

  it("component file names are camelCase", () => {
    const folders = files(src)
      .map(rel)
      .filter((p) => p.startsWith("components/") || /\/(components|ui)\/[^/]+$/.test(p));
    expect(folders.filter((p) => !/^[a-z][A-Za-z0-9]*\.tsx?$/.test(p.split("/").pop()!))).toEqual([]);
  });
});

// Shared code is sorted by what it is, never left in a heap: components by
// their role, logic by its kind (see the README's "Project structure").
describe("shared code is sorted", () => {
  const COMPONENT_ROLES = ["ui", "providers", "brand", "preferences", "accounts", "statements", "transactions", "insights", "tour", "connect"];
  const LIB_KINDS = ["finance", "content", "server", "actions", "statements", "providers", "i18n", "auth", "browser"];
  // The few helpers every layer uses stay at the top of lib/.
  const LIB_ROOT_FILES = ["utils.ts", "cache.ts", "parallel.ts", "scrub.ts", "uploadLimit.ts", "selectedAccount.ts"];
  const specsOf = (file: string) => [...readFileSync(file, "utf8").matchAll(/(?:from|import\s*\()\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const targetOf = (file: string, spec: string) =>
    spec.startsWith("@/") ? rel(join(src, spec.slice(2))) : spec.startsWith(".") ? rel(join(file, "..", spec)) : null;

  it("every shared component sits in a folder named for its role", () => {
    const misplaced = files(join(src, "components"))
      .map(rel)
      .filter((p) => !COMPONENT_ROLES.includes(p.split("/")[1]) || p.split("/").length !== 3);
    expect(misplaced).toEqual([]);
  });

  it("lib/ holds its kinds of logic in folders, and only a few small helpers loose", () => {
    const misplaced = files(join(src, "lib"))
      .map(rel)
      .filter((p) => {
        const [, first, ...rest] = p.split("/");
        return rest.length === 0 ? !LIB_ROOT_FILES.includes(first) : !LIB_KINDS.includes(first);
      });
    expect(misplaced).toEqual([]);
  });

  it("the money engine (lib/finance) is pure: no data access, no framework, no browser", () => {
    const offenders: string[] = [];
    for (const file of files(join(src, "lib/finance"))) {
      for (const spec of specsOf(file)) {
        const target = targetOf(file, spec) ?? "";
        if (/^(next|react)(\/|$)/.test(spec) || /^lib\/(server|actions|providers|browser)\//.test(target)) offenders.push(`${rel(file)} -> ${spec}`);
      }
      // The code only: a comment may well say "the same window." in plain English.
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      if (/\b(window|document|localStorage|sessionStorage)\.|\bfetch\(/.test(code)) offenders.push(`${rel(file)}: touches the browser or the network`);
    }
    expect(offenders).toEqual([]);
  });

  it("a shared component used by only one page lives in that page's folder", () => {
    const pageOf = (p: string) => p.match(/^app\/\(root\)\/\(([^)]+)\)\//)?.[1] ?? p.match(/^app\/\(([^)]+)\)\//)?.[1] ?? null;
    const importers = new Map<string, Set<string>>();
    for (const file of files(src)) {
      for (const spec of specsOf(file)) {
        const target = targetOf(file, spec);
        if (!target?.startsWith("components/")) continue;
        const key = [".tsx", ".ts", ""].map((ext) => target + ext).find((t) => files(join(src, "components")).some((f) => rel(f) === t));
        if (!key) continue;
        // Anything outside a page (another shared file, the app's root layout) counts as shared use.
        importers.set(key, (importers.get(key) ?? new Set()).add(pageOf(rel(file)) ?? "(shared)"));
      }
    }
    const onePage = [...importers].filter(([, by]) => by.size === 1 && !by.has("(shared)")).map(([file, by]) => `${file} (only ${[...by][0]})`);
    expect(onePage).toEqual([]);
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

// Settings (goals, corrections, column layouts) live on the profile row since
// the move to Supabase sign-in: reading them by the login id finds nothing.
describe("settings are read by the profile id", () => {
  it("never with authIdOf", () => {
    const offenders = files(src)
      .filter((p) => /(loadGoals|loadCorrections|readPrefs|updatePrefs|storeGoals|storeCorrections)\(\s*authIdOf/.test(readFileSync(p, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
