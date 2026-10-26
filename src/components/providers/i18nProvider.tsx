"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { translatorFor, type Translate } from "@/lib/i18n/translator";

// The language chosen on the server, and that language's text. The text comes
// down as data with the page (messagesFor in lib/i18n/translate.ts), so the
// browser never loads the other languages' words as script.
// Also the person's own regional language (a cookie), which the picker leads with.
const I18nContext = createContext<{ locale: Locale; messages: Messages; homeLocale: Locale | null }>({ locale: DEFAULT_LOCALE, messages: {}, homeLocale: null });

export function I18nProvider({
  locale,
  messages,
  homeLocale = null,
  children,
}: {
  locale: Locale;
  messages: Messages;
  homeLocale?: Locale | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages, homeLocale }), [locale, messages, homeLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useLocale = () => useContext(I18nContext).locale;

/** The person's own regional language, if known (the picker leads with it). */
export const useHomeLocale = () => useContext(I18nContext).homeLocale;

/** Translator for client components: const t = useT(); t("area.key"). */
export function useT(): Translate {
  const { messages } = useContext(I18nContext);
  return useMemo(() => translatorFor(messages), [messages]);
}
