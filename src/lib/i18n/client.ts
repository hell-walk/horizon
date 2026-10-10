import { LOCALE_COOKIE, type Locale } from "./config";

/** Client side: remember the chosen language for a year. */
export function rememberLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
