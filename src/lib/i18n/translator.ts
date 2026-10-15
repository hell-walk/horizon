// The translating function itself, with no text tables in it: the browser
// imports this and receives the words as data (see I18nProvider).

import type { Messages } from "./messages"; // a type only: the tables stay out of the browser

export type Vars = Record<string, string | number>;

/**
 * t("area.key", { name: "Asha" }) looks the text up in the chosen language,
 * falls back to English, and fills {placeholders}. For counts, write two keys,
 * "area.key_one" and "area.key_other", and pass { count }: t picks the right one.
 * A missing key shows the key itself, so it is easy to spot (and a test fails).
 */
export type Translate = (key: string, vars?: Vars) => string;

/** A translator over one ready dictionary (lib/i18n/translate.ts makes those). */
export function translatorFor(messages: Messages): Translate {
  return (key, vars) => {
    const pluralKey = vars && typeof vars.count === "number" ? `${key}_${vars.count === 1 ? "one" : "other"}` : null;
    const text = (pluralKey && messages[pluralKey]) ?? messages[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
  };
}
