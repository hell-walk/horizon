import { LOCALE_TAGS, type Locale } from "./i18n/config";
import type { Translate } from "./i18n/translate";
import type { Regular } from "./recurring";

// Words and dates for regular payments, shared by the bills page and Home.

const DAY = 86_400_000;

/** Whole days from today (UTC) to a YYYY-MM-DD date; negative when it has passed. */
export const daysUntil = (date: string, today = new Date()) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / DAY);

export const dateFormat = (locale: Locale, options: Intl.DateTimeFormatOptions) => {
  const format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { ...options, timeZone: "UTC" });
  return (date: string) => format.format(new Date(`${date}T00:00:00Z`));
};

/** "in 3 days", "today", "was due 5 Oct, not in your statements yet"... in words. */
export function whenText(t: Translate, r: Pick<Regular, "status" | "next" | "missedSince">, day: (d: string) => string) {
  if (r.status === "missed" || r.status === "stopped") return t("bills.whenMissed", { date: day(r.missedSince ?? r.next) });
  if (r.status === "unseen") return t("bills.whenUnseen", { date: day(r.next) });
  const days = daysUntil(r.next);
  if (days === 0) return t("bills.whenToday");
  if (days === 1) return t("bills.whenTomorrow");
  return t("bills.whenInDays", { count: days, date: day(r.next) });
}
