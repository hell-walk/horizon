// Languages the interface is offered in. Only interface text is translated:
// balances, names, payees and statement contents are never sent anywhere to be
// translated. New languages: see scripts/translate-messages.mjs.

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "horizon-lang";

/** Each language's name written in itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिंदी" };

/** BCP 47 tags for <html lang> and number/date formatting. */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-IN", hi: "hi-IN" };

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);
