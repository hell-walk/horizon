import { DEFAULT_LOCALE, type Locale } from "./config";
import { loadMessages, type Messages } from "./messages";
import { translatorFor, type Translate } from "./translator";

export type { Translate, Vars } from "./translator";

// The server side: every language is here (MESSAGES). The browser gets one
// language as data and only the small helper in ./translator.ts as script.

export async function makeTranslator(locale: Locale): Promise<Translate> {
  return translatorFor(await messagesFor(locale));
}

/**
 * One language's text with English filling any gaps: what the browser gets.
 * The server holds every language (MESSAGES); the browser only needs the one
 * on screen, so this is handed to it as data instead of shipping all of them
 * as script.
 */
export async function messagesFor(locale: Locale): Promise<Messages> {
  let merged = MERGED.get(locale);
  if (!merged) {
    merged = (async () => {
      const english = await loadMessages(DEFAULT_LOCALE);
      return locale === DEFAULT_LOCALE ? english : { ...english, ...(await loadMessages(locale)) };
    })();
    merged.catch(() => MERGED.delete(locale));
    MERGED.set(locale, merged);
  }
  return merged;
}

// Each language merged over English once, then kept.
const MERGED = new Map<Locale, Promise<Messages>>();
