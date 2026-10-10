import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { makeTranslator } from "./translate";

/**
 * The language for this request: the one the user picked (cookie), else the
 * browser's preferred language if we have it, else English.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  let chosen: string | undefined;
  let accepted = "";
  try {
    chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
    accepted = (await headers()).get("accept-language") ?? "";
  } catch {
    return DEFAULT_LOCALE; // outside a request (scripts, tests): English
  }
  if (isLocale(chosen)) return chosen;
  for (const part of accepted.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
});

/** Translator for server components and server actions. */
export async function getT() {
  return makeTranslator(await getLocale());
}
