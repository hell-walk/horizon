import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";

import type { CalendarDay, CalendarEvent } from "@/lib/finance/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/finance/regularText";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
/** Names shown inside a cell on wide screens; the rest become "+n". */
const NAMES_PER_CELL = 2;

/** The month a date belongs to, "YYYY-MM". */
export const monthOf = (date: string) => date.slice(0, 7);

/** The months between two dates, first to last. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const last = to.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= last) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Money in, EMIs, and everything else: the three colours a day can carry. */
const tone = (e: CalendarEvent): "in" | "emi" | "other" => (e.amount > 0 ? "in" : e.kind === "emi" ? "emi" : "other");
const DOT: Record<"in" | "emi" | "other", string> = { in: "bg-success", emi: "bg-danger", other: "bg-ink-muted" };

/**
 * A month at a glance: every day in its place, with what is expected on it.
 * Salary and other money in are green, EMIs red, the rest grey. A day links
 * to its card below. For someone who has not subscribed, days past the free
 * week show a lock instead of their events.
 */
const MonthGrid = ({
  month,
  months,
  days,
  from,
  to,
  today,
  freeUntil,
  subscribed,
  locale,
  t,
}: {
  month: string;
  months: string[];
  days: CalendarDay[];
  from: string;
  to: string;
  today: string;
  freeUntil: string;
  subscribed: boolean;
  locale: Locale;
  t: Translate;
}) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = Date.UTC(year, monthIndex - 1, 1);
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7; // weeks start on Monday
  const byDate = new Map(days.map((d) => [d.date, d]));
  const monthName = dateFormat(locale, { month: "long", year: "numeric" })(`${month}-01`);
  const weekday = dateFormat(locale, { weekday: "short" });
  const at = months.indexOf(month);
  const prev = at > 0 ? months[at - 1] : null;
  const next = at >= 0 && at < months.length - 1 ? months[at + 1] : null;
  const anything = Array.from({ length: count }, (_, i) => new Date(first + i * DAY).toISOString().slice(0, 10)).some((d) => byDate.has(d));

  return (
    <section className="panel" aria-labelledby="month-grid-title">
      <header className="panel-head">
        <h2 id="month-grid-title" className="eyebrow">
          {monthName}
        </h2>
        <span className="flex items-center gap-1">
          {prev ? (
            <Link href={`/calendar?month=${prev}`} className="btn-ghost btn-sm" aria-label={t("calendar.monthPrev")}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className="btn-ghost btn-sm opacity-40" aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
          {next ? (
            <Link href={`/calendar?month=${next}`} className="btn-ghost btn-sm" aria-label={t("calendar.monthNext")}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className="btn-ghost btn-sm opacity-40" aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </span>
      </header>

      <div className="grid grid-cols-7 border-b border-line text-center">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="eyebrow py-2">
            {weekday(`2024-01-0${i + 1}`)}
          </span>
        ))}
      </div>

      <ol className="grid grid-cols-7 gap-px bg-line" role="list">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} className="min-h-14 bg-surface-low sm:min-h-24" aria-hidden />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(first + i * DAY).toISOString().slice(0, 10);
          const day = byDate.get(date);
          const inWindow = date >= from && date <= to;
          const locked = !subscribed && date > freeUntil && !!day;
          const isToday = date === today;
          const events = day?.events ?? [];
          const tones = [...new Set(events.map(tone))];
          const cell = (
            <>
              <span
                className={cn(
                  "text-12 font-semibold",
                  isToday
                    ? "inline-flex size-6 items-center justify-center rounded-full bg-lime text-lime-foreground"
                    : inWindow
                      ? "text-ink"
                      : "text-ink-faint",
                )}
              >
                {i + 1}
              </span>
              {locked ? (
                <Lock className="size-3.5 text-ink-muted" aria-label={t("calendar.gridLocked")} />
              ) : (
                events.length > 0 && (
                  <>
                    <span className="flex gap-1 sm:hidden" aria-hidden>
                      {tones.map((k) => (
                        <span key={k} className={cn("size-1.5 rounded-full", DOT[k])} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {events.slice(0, NAMES_PER_CELL).map((e, j) => (
                        <span key={j} translate="no" className="flex items-center gap-1 truncate text-11 text-ink">
                          <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone(e)])} aria-hidden />
                          <span className="truncate">{e.name}</span>
                        </span>
                      ))}
                      {events.length > NAMES_PER_CELL && <span className="text-11 text-ink-muted">+{events.length - NAMES_PER_CELL}</span>}
                    </span>
                  </>
                )
              )}
            </>
          );
          const classes = cn(
            "flex min-h-14 flex-col items-start gap-1 bg-card p-1.5 sm:min-h-24 sm:p-2",
            !inWindow && "bg-surface-low",
            day && !locked && "hover:bg-surface-container",
          );
          return (
            <li key={date} className="contents">
              {day && !locked ? (
                <a
                  href={`#day-${date}`}
                  className={classes}
                  aria-label={`${dateFormat(locale, { weekday: "long", day: "numeric", month: "long" })(date)}: ${events.map((e) => e.name).join(", ")}`}
                >
                  {cell}
                </a>
              ) : locked ? (
                <Link href="/plans" className={classes} aria-label={t("calendar.gridLocked")}>
                  {cell}
                </Link>
              ) : (
                <div className={classes}>{cell}</div>
              )}
            </li>
          );
        })}
        {Array.from({ length: (7 - ((lead + count) % 7)) % 7 }, (_, i) => (
          <li key={`trail-${i}`} className="min-h-14 bg-surface-low sm:min-h-24" aria-hidden />
        ))}
      </ol>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-12 text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", DOT.in)} aria-hidden /> {t("calendar.legendIn")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", DOT.emi)} aria-hidden /> {t("calendar.legendEmi")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", DOT.other)} aria-hidden /> {t("calendar.legendOther")}
        </span>
        {!anything && <span>{t("calendar.gridNothing")}</span>}
      </footer>
    </section>
  );
};

export default MonthGrid;
