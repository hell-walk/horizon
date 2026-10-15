import { DEFAULT_LOCALE, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";
import { translatorFor, type Translate } from "./translator";

export type { Translate, Vars } from "./translator";

// The server side: every language is here (MESSAGES). The browser gets one
// language as data and only the small helper in ./translator.ts as script.

export function makeTranslator(locale: Locale): Translate {
  return translatorFor(messagesFor(locale));
}

/**
 * One language's text with English filling any gaps: what the browser gets.
 * The server holds every language (MESSAGES); the browser only needs the one
 * on screen, so this is handed to it as data instead of shipping all of them
 * as script.
 */
export function messagesFor(locale: Locale): Messages {
  return locale === DEFAULT_LOCALE ? MESSAGES[DEFAULT_LOCALE] : { ...MESSAGES[DEFAULT_LOCALE], ...MESSAGES[locale] };
}
