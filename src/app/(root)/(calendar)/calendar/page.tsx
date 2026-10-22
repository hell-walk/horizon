import type { Metadata } from "next";
import { CalendarDays, CircleAlert, Gem, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BarsLoader } from "@/components/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { buildCalendar, type CalendarDay } from "@/lib/calendar";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/regularText";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { accountForecast, type AccountForecast } from "@/lib/server/forecast";
import { currentPlan } from "@/lib/server/plan";
import { cn, formatAmount, maskLabel } from "@/lib/utils";
import MonthGrid, { monthOf, monthsBetween } from "../components/monthGrid";

/** Days everyone sees; subscribers see the whole window. */
const FREE_DAYS = 7;
const WINDOW_DAYS = 45;
const DAY = 86_400_000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("calendar.metaTitle"), description: t("calendar.metaDescription") };
}

const CalendarPage = async ({ searchParams }: { searchParams: Promise<{ month?: string }> }) => {
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const t = await getT();
  const { month } = await searchParams;

  return (
    <section className="page">
      <HeaderBox eyebrow={t("calendar.eyebrow")} title={t("calendar.title")} subtext={t("calendar.subtext")} />
      <Suspense
        fallback={
          <div className="panel">
            <BarsLoader className="h-64" />
          </div>
        }
      >
        <CalendarContent ownerId={ownerIdOf(user)} month={typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : undefined} />
      </Suspense>
    </section>
  );
};

async function CalendarContent({ ownerId, month: wanted }: { ownerId: string; month?: string }) {
  const [t, locale, accounts, plan] = await Promise.all([getT(), getLocale(), getAccounts({ userId: ownerId }), currentPlan()]);
  const today = new Date();
  const forecasts = (
    await Promise.all(((accounts?.data as Account[]) ?? []).map((a) => accountForecast(a.appwriteItemId, { today, days: WINDOW_DAYS })))
  ).filter((f): f is AccountForecast => f !== null);
  const calendar = buildCalendar(forecasts);
  const subscribed = plan?.kind === "subscribed";
  const day = dateFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const todayIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  const freeUntil = new Date(Date.parse(`${todayIso}T00:00:00Z`) + FREE_DAYS * DAY).toISOString().slice(0, 10);
  const money = (n: number, currency?: string | null) => formatAmount(n, currency ?? calendar.currency ?? "INR");

  if (calendar.days.length === 0) {
    return (
      <div className="panel panel-body flex max-w-2xl flex-col gap-3">
        <p className="text-14 text-ink">{t("calendar.empty")}</p>
        <Link href="/upload-statement" className="btn-secondary w-fit">
          {t("home.actionUpload")}
        </Link>
      </div>
    );
  }

  // The grid shows the months the window touches, from this one; a month asked for outside them falls back to this one.
  const months = monthsBetween(todayIso, calendar.to);
  const month = wanted && months.includes(wanted) ? wanted : monthOf(todayIso);
  const shown = subscribed ? calendar.days : calendar.days.filter((d) => d.date <= freeUntil);
  const hidden = calendar.days.length - shown.length;
  const week = calendar.days.filter((d) => d.date <= freeUntil).flatMap((d) => d.events);
  const weekOut = week.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const weekIn = week.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("calendar.tileOut")} value={money(-weekOut)} note={t("calendar.tileWeekNote", { count: FREE_DAYS })} />
        <Tile label={t("calendar.tileIn")} value={money(weekIn)} note={t("calendar.tileWeekNote", { count: FREE_DAYS })} />
        {subscribed && calendar.lowest ? (
          <Tile label={t("calendar.tileLowest")} value={money(calendar.lowest.total)} note={day(calendar.lowest.date)} warn={calendar.lowest.total < 0} />
        ) : (
          <Tile label={t("calendar.tileLowest")} value="••••" note={t("calendar.tileLowestLocked")} />
        )}
      </div>

      <p className="text-12 text-ink-muted">{t("calendar.evidenceNote", { date: day(calendar.from) })}</p>

      <MonthGrid
        month={month}
        months={months}
        days={calendar.days}
        from={calendar.from}
        to={calendar.to}
        today={todayIso}
        freeUntil={freeUntil}
        subscribed={subscribed}
        locale={locale}
        t={t}
      />

      {subscribed && calendar.belowZero && (
        <p className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-13 text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("calendar.belowZero", {
              name: `${calendar.belowZero.account.name} ${maskLabel(calendar.belowZero.account.mask)}`,
              date: day(calendar.belowZero.date),
            })}
          </span>
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {shown.map((d) => (
          <DayCard key={d.date} day={d} today={todayIso} t={t} label={day} money={money} subscribed={subscribed} />
        ))}
      </ol>

      {!subscribed && hidden > 0 && (
        <div className="panel panel-body flex flex-col gap-3">
          <p className="flex items-start gap-2 text-14 text-ink">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("calendar.lockedTitle", { count: hidden })}</span>
          </p>
          <p className="text-13 text-ink-muted">{t("calendar.lockedText", { days: WINDOW_DAYS })}</p>
          <Link href="/plans" className="btn-primary w-fit">
            <Gem className="size-4" aria-hidden /> {t("home.checksSeePlans")}
          </Link>
        </div>
      )}

      {calendar.without.length > 0 && (
        <p className="text-12 text-ink-muted">{t("calendar.without", { names: calendar.without.map((a) => `${a.name} ${maskLabel(a.mask)}`).join(", ") })}</p>
      )}
      <details className="panel">
        <summary className="panel-head cursor-pointer">
          <span className="eyebrow">{t("calendar.howTitle")}</span>
        </summary>
        <p className="px-4 pb-4 text-13 text-ink-muted">{t("calendar.how")}</p>
      </details>
    </>
  );
}

const Tile = ({ label, value, note, warn = false }: { label: string; value: string; note: string; warn?: boolean }) => (
  <div className="panel flex flex-col gap-1 p-4">
    <span className="eyebrow">{label}</span>
    <span translate="no" className={cn("amount text-20 font-semibold", warn ? "text-danger" : "text-ink")}>
      {value}
    </span>
    <span className="text-12 text-ink-muted">{note}</span>
  </div>
);

/** One day: what is expected, and where each account stands after it. */
const DayCard = ({
  day,
  today,
  t,
  label,
  money,
  subscribed,
}: {
  day: CalendarDay;
  today: string;
  t: Translate;
  label: (d: string) => string;
  money: (n: number, currency?: string | null) => string;
  subscribed: boolean;
}) => (
  <li id={`day-${day.date}`} className="panel scroll-mt-20">
    <header className="panel-head">
      <span className="flex items-center gap-2">
        <CalendarDays className="size-3.5 text-ink-muted" aria-hidden />
        <span className="eyebrow">{label(day.date)}</span>
        {day.date <= today && <span className="chip">{t("calendar.dueAlready")}</span>}
      </span>
      {subscribed && day.total !== null && (
        <span translate="no" className={cn("amount text-13 font-semibold", day.total < 0 ? "text-danger" : "text-ink")}>
          {t("calendar.afterDay", { amount: money(day.total) })}
        </span>
      )}
    </header>
    <ul className="divide-y divide-line">
      {day.events.map((e, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span translate="no" className="truncate text-14 font-semibold text-ink">
              {e.name}
            </span>
            <span className="text-12 text-ink-muted">
              {t(`bills.kind_${e.kind}`)} · {e.confidence === "low" && <>{t("calendar.estimated")} · </>}
              <span translate="no">
                {e.account.name} {maskLabel(e.account.mask)}
              </span>
            </span>
          </span>
          <span translate="no" className={cn("amount shrink-0 text-14 font-semibold", e.amount < 0 ? "text-ink" : "text-success")}>
            {e.amount < 0 ? "−" : "+"}
            {money(Math.abs(e.amount), e.account.currency)}
          </span>
        </li>
      ))}
    </ul>
    {subscribed && day.balances.length > 1 && (
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-12 text-ink-muted">
        {day.balances.map((b) => (
          <span key={b.account.id} translate="no" className={cn(b.balance < 0 && "text-danger")}>
            {b.account.name} {maskLabel(b.account.mask)}: {money(b.balance, b.account.currency)}
          </span>
        ))}
      </p>
    )}
  </li>
);

export default CalendarPage;
