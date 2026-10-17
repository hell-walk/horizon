import { HOME_LOCALE_COOKIE, LOCALE_COOKIE, type Locale } from "./config";

/** Client side: remember the chosen language for a year. */
export function rememberLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Client side: remember the person's own regional language for a year (the picker leads with it). */
export function rememberHomeLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${HOME_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
