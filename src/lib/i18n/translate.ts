import { DEFAULT_LOCALE, type Locale } from "./config";
import { MESSAGES } from "./messages";

export type Vars = Record<string, string | number>;

/**
 * t("area.key", { name: "Asha" }) looks the text up in the chosen language,
 * falls back to English, and fills {placeholders}. For counts, write two keys,
 * "area.key_one" and "area.key_other", and pass { count }: t picks the right one.
 * A missing key shows the key itself, so it is easy to spot (and a test fails).
 */
export type Translate = (key: string, vars?: Vars) => string;

export function makeTranslator(locale: Locale): Translate {
  const own = MESSAGES[locale];
  const fallback = MESSAGES[DEFAULT_LOCALE];
  return (key, vars) => {
    const pluralKey = vars && typeof vars.count === "number" ? `${key}_${vars.count === 1 ? "one" : "other"}` : null;
    const text = (pluralKey && (own[pluralKey] ?? fallback[pluralKey])) ?? own[key] ?? fallback[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
  };
}
