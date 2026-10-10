"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { makeTranslator, type Translate } from "@/lib/i18n/translate";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Gives client components the language chosen on the server. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** Translator for client components: const t = useT(); t("area.key"). */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => makeTranslator(locale), [locale]);
}
