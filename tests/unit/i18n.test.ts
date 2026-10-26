import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STATEMENT_BANKS } from "@/lib/content/bankGuides";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { loadMessages, type Messages } from "@/lib/i18n/messages";
import { makeTranslator } from "@/lib/i18n/translate";

const src = join(__dirname, "../../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
// Every language, loaded once for these tests.
const MESSAGES = Object.fromEntries(await Promise.all(LOCALES.map(async (locale) => [locale, await loadMessages(locale)]))) as Record<Locale, Messages>;

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const english = MESSAGES.en;

  it.each(LOCALES.filter((l) => l !== "en"))("%s has exactly the English keys", (locale) => {
    expect(Object.keys(MESSAGES[locale]).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(LOCALES)("%s has no empty texts", (locale) => {
    expect(Object.entries(MESSAGES[locale]).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%s keeps every {placeholder} of the English text", (locale) => {
    const broken = Object.keys(english).filter(
      (key) => MESSAGES[locale][key] && placeholders(MESSAGES[locale][key]).join() !== placeholders(english[key]).join(),
    );
    expect(broken).toEqual([]);
  });

  it("every key used in the code exists", () => {
    const used = new Set<string>();
    for (const file of files(src)) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, ""); // comments are not code
      for (const m of code.matchAll(/\bt\(\s*["']([a-z]+\.[A-Za-z0-9_.]+)["']/g)) used.add(m[1]);
    }
    const missing = [...used].filter((key) => !(key in english) && !(`${key}_one` in english && `${key}_other` in english));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(0);
  });

  it("every bank in the guided import has a password hint", () => {
    for (const id of [...STATEMENT_BANKS.map((b) => b.id), "other"]) expect(english, id).toHaveProperty(`connect.guidePassword_${id}`);
  });

  it("t fills placeholders, picks plurals and falls back to English", async () => {
    const t = await makeTranslator("hi");
    expect((await makeTranslator("en"))("common.skipToContent")).toBe("Skip to main content");
    expect(t("common.skipToContent")).not.toBe("Skip to main content");
    expect(t("no.such.key")).toBe("no.such.key");
  });
});

describe("the language picker's short list", () => {
  it("is the home language, Hindi and English, plus the current one; everything without a home language", async () => {
    const { pickerLocales, LOCALES: all } = await import("@/lib/i18n/config");
    expect(pickerLocales("ta", "ta")).toEqual(["ta", "hi", "en"]);
    expect(pickerLocales("ta", "bn")).toEqual(["ta", "hi", "en", "bn"]);
    expect(pickerLocales("hi", "en")).toEqual(["hi", "en"]);
    expect(pickerLocales(null, "en")).toEqual([...all]);
  });
});
