// Languages the interface is offered in. Only interface text is translated:
// balances, names, payees and statement contents are never sent anywhere to be
// translated. New languages: see scripts/translate-messages.mjs.

export const LOCALES = ["en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "or", "pa"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "horizon-lang";

/** Each language's name written in itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
  bn: "বাংলা",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  or: "ଓଡ଼ିଆ",
  pa: "ਪੰਜਾਬੀ",
};

/** Each language's name in English, shown under its own name in the picker. */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  te: "Telugu",
  ta: "Tamil",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  or: "Odia",
  pa: "Punjabi",
};

/**
 * BCP 47 tags for <html lang> and number/date formatting. "-u-nu-latn" keeps
 * digits Latin (0-9) in every language, as amounts are written everywhere else.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN-u-nu-latn",
  bn: "bn-IN-u-nu-latn",
  mr: "mr-IN-u-nu-latn",
  te: "te-IN-u-nu-latn",
  ta: "ta-IN-u-nu-latn",
  gu: "gu-IN-u-nu-latn",
  kn: "kn-IN-u-nu-latn",
  ml: "ml-IN-u-nu-latn",
  or: "or-IN-u-nu-latn",
  pa: "pa-IN-u-nu-latn",
};

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);
