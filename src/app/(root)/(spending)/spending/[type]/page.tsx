import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Gem, Lock, TrendingDown, TrendingUp, X } from "lucide-react";

import { BarsLoader } from "@/components/ui/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { CHART_COLOR_CLASSES, chartColorClass, spendTypeLabel } from "@/constants";
import type { Locale } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/finance/regularText";
import { getAccount, getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { currentPlan } from "@/lib/server/plan";
import { activeAccountId } from "@/lib/server/selectedAccount";
import RememberAccount from "@/components/accounts/rememberAccount";
import { MISC, spendingDetail, type DetailEntry, type SpendingDetail } from "@/lib/finance/spendingDetail";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

import PayeePie from "../../components/payeePie";
import ScrollHere from "../../components/scrollHere";

type Props = { params: Promise<{ type: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

const isSlug = (s: string) => /^[a-z0-9-]{1,40}$/.test(s);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("spending.metaTitle") };
}

/**
 * One slice of the Home spending chart, looked at closely: who the money went
 * to, month by month, which days, the biggest payments and every entry. A
 * subscriber feature: everyone else sees the total, and the rest stays on the server.
 */
const SpendingType = async ({ params, searchParams }: Props) => {
  const { type } = await params;
  if (!isSlug(type)) notFound();
  const { id, payee } = await searchParams;
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  const accounts = ((await getAccounts({ userId: ownerIdOf(user) }))?.data as Account[] | undefined) ?? [];
  const appwriteItemId = await activeAccountId(accounts, typeof id === "string" ? id : undefined);
  const account = accounts.find((a) => a.appwriteItemId === appwriteItemId);
  if (!account) redirect("/");

  return (
    <section className="page">
      <RememberAccount id={account.appwriteItemId} />
      {/* Back to the account's history, where the entries themselves are. */}
      <Link href={`/transaction-history?id=${account.appwriteItemId}`} className="btn-ghost btn-sm w-fit">
        <ArrowLeft className="size-4" aria-hidden /> {t("spending.back")}
      </Link>
      <Suspense
        fallback={
          <>
            <div className="h-24" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="panel p-4">
                  <BarsLoader className="h-[76px]" />
                </div>
              ))}
            </div>
            <div className="panel">
              <BarsLoader className="h-64" />
            </div>
          </>
        }
      >
        <SpendingContent slug={type} account={account} payee={typeof payee === "string" ? payee.slice(0, 80) : undefined} />
      </Suspense>
    </section>
  );
};

async function SpendingContent({ slug, account, payee }: { slug: string; account: Account; payee?: string }) {
  const t = await getT();
  const locale = await getLocale();
  const [loaded, plan] = await Promise.all([getAccount({ appwriteItemId: account.appwriteItemId }), currentPlan()]);
  const detail = spendingDetail((loaded?.transactions as Transaction[] | undefined) ?? [], slug);
  if (!detail) notFound();

  const name = spendTypeLabel(t, detail.name);
  const currency = account.currency ?? "INR";
  const money = (n: number) => formatAmount(n, currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const header = <HeaderBox eyebrow={`${account.name} ${maskLabel(account.mask)}`} title={name} subtext={t("spending.intro", { name })} />;

  if (plan?.kind !== "subscribed") {
    return (
      <>
        {header}
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile
            label={t("spending.tileTotal")}
            value={money(detail.total)}
            note={t("spending.tileTotalNote", { from: day(detail.from), to: day(detail.to) })}
          />
          <Tile label={t("spending.tileCount")} value={String(detail.count)} note={t("spending.tileCountNote", { amount: money(detail.average) })} />
        </div>
        <Locked t={t} name={name} />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("spending.tileTotal")} value={money(detail.total)} note={t("spending.tileTotalNote", { from: day(detail.from), to: day(detail.to) })} />
        <Tile label={t("spending.tileCount")} value={String(detail.count)} note={t("spending.tileCountNote", { amount: money(detail.average) })} />
        <Tile
          label={t("spending.tileShare")}
          value={`${Math.round(detail.share * 100)}%`}
          note={t("spending.tileShareNote", { total: money(detail.allSpent) })}
        />
      </div>

      {detail.compare && <Compare t={t} locale={locale} compare={detail.compare} money={money} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Payees t={t} detail={detail} money={money} currency={currency} linkBase={`/spending/${slug}?id=${account.appwriteItemId}&payee=`} picked={payee} />
          {/* The picked payee's payments, right under the list they were picked from; the page scrolls to them as they arrive. */}
          {payee && detail.payeeEntries[payee] && (
            <section className="panel scroll-mt-4" aria-labelledby="spending-payee">
              <ScrollHere to={payee} />
              <header className="panel-head">
                <h2 id="spending-payee" className="eyebrow">
                  {t("spending.payeeEntriesTitle", { name: payee, count: detail.payeeEntries[payee].length })}
                </h2>
                <Link href={`/spending/${slug}?id=${account.appwriteItemId}`} scroll={false} className="btn-ghost btn-sm">
                  <X className="size-3.5" aria-hidden /> {t("spending.payeeClear")}
                </Link>
              </header>
              <EntryRows entries={detail.payeeEntries[payee]} money={money} day={day} />
            </section>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Months t={t} locale={locale} detail={detail} money={money} />
          <Weekdays t={t} locale={locale} detail={detail} money={money} />
        </div>
      </div>

      {detail.upi && (
        <section className="panel" aria-labelledby="spending-upi">
          <header className="panel-head">
            <h2 id="spending-upi" className="eyebrow">
              {t("spending.upiTitle")}
            </h2>
          </header>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Split
              label={t("spending.upiPeople")}
              amount={money(detail.upi.people.amount)}
              count={detail.upi.people.count}
              total={detail.total}
              part={detail.upi.people.amount}
              t={t}
            />
            <Split
              label={t("spending.upiShops")}
              amount={money(detail.upi.shops.amount)}
              count={detail.upi.shops.count}
              total={detail.total}
              part={detail.upi.shops.amount}
              t={t}
            />
          </div>
        </section>
      )}

      <EntryList id="spending-biggest" title={t("spending.biggestTitle")} entries={detail.biggest} money={money} day={day} />
      <details className="panel">
        <summary className="panel-head cursor-pointer">
          <span className="eyebrow">{t("spending.entriesTitle", { count: detail.count })}</span>
        </summary>
        <EntryRows entries={detail.entries} money={money} day={day} />
      </details>
    </>
  );
}

const Locked = ({ t, name }: { t: Translate; name: string }) => (
  <section className="panel relative overflow-hidden" aria-labelledby="spending-locked">
    {/* A shape of what is behind the lock, drawn from nothing real. */}
    <div aria-hidden className="pointer-events-none grid select-none gap-4 p-4 blur-sm sm:grid-cols-2">
      <div className="mx-auto size-40 rounded-full border-[14px] border-surface-container" />
      <div className="flex flex-col justify-end gap-2">
        {[0.5, 0.8, 0.35, 0.65, 0.9, 0.45].map((h, i) => (
          <div key={i} className="h-3 rounded-sm bg-surface-container" style={{ width: `${h * 100}%` }} />
        ))}
      </div>
    </div>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-low/70 px-6 text-center">
      <Lock className="size-5 text-ink" aria-hidden />
      <h2 id="spending-locked" className="text-16 font-semibold text-ink">
        {t("spending.lockedTitle", { name })}
      </h2>
      <p className="max-w-md text-13 text-ink-muted">{t("spending.lockedText")}</p>
      <Link href="/plans" className="btn-accent">
        <Gem className="size-4" aria-hidden /> {t("spending.lockedAction")}
      </Link>
    </div>
  </section>
);

const Compare = ({
  t,
  locale,
  compare,
  money,
}: {
  t: Translate;
  locale: Locale;
  compare: NonNullable<SpendingDetail["compare"]>;
  money: (n: number) => string;
}) => {
  const month = dateFormat(locale, { month: "long", year: "numeric" })(`${compare.month}-01`);
  const close = Math.abs(compare.difference) < Math.max(compare.usual * 0.1, 1);
  const up = compare.difference > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={cn("panel panel-body flex items-start gap-2 text-14 text-ink", !close && up && "border-warn/40 bg-warn/10")}>
      {!close && <Icon className={cn("mt-0.5 size-4 shrink-0", up ? "text-warn-ink" : "text-success")} aria-hidden />}
      {close
        ? t("spending.compareSame", { month, usual: money(compare.usual) })
        : t(up ? "spending.compareUp" : "spending.compareDown", { month, difference: money(Math.abs(compare.difference)), usual: money(compare.usual) })}
    </p>
  );
};

const Payees = ({
  t,
  detail,
  money,
  currency,
  linkBase,
  picked,
}: {
  t: Translate;
  detail: SpendingDetail;
  money: (n: number) => string;
  currency: string;
  /** This page's address with "&payee=" at the end: a payee's name completes it. */
  linkBase: string;
  picked?: string;
}) => (
  <section className="panel" aria-labelledby="spending-payees">
    <header className="panel-head">
      <h2 id="spending-payees" className="eyebrow">
        {t("spending.payeesTitle")}
      </h2>
    </header>
    <div className="panel-body flex flex-col gap-5">
      <PayeePie payees={detail.payees} currency={currency} total={detail.total} linkBase={linkBase} />
      <ul className="flex flex-col divide-y divide-line">
        {detail.payees.map((p, i) => (
          <li key={p.name}>
            <PayeeRow
              href={`${linkBase}${encodeURIComponent(p.name)}`}
              current={p.name === picked}
              left={
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", chartColorClass(p.name, i))} />
                  <span translate="no" className="truncate text-14 font-semibold text-ink">
                    {spendTypeLabel(t, p.name)}
                  </span>
                </span>
              }
              right={
                <span className="flex shrink-0 items-baseline gap-2">
                  <span translate="no" className="amount text-14 font-semibold text-ink">
                    {money(p.amount)}
                  </span>
                  <span className="eyebrow">{Math.round(p.share * 100)}%</span>
                </span>
              }
            />
          </li>
        ))}
      </ul>
      {detail.payees.some((p) => p.name === MISC) && <p className="text-13 text-ink-muted">{t("spending.miscNote")}</p>}
    </div>
    {/* The pie folds one-off payments into "Miscellaneous"; here is everyone, one line each. */}
    {detail.allPayees.length > detail.payees.length && (
      <details className="border-t border-line">
        <summary className="panel-head cursor-pointer">
          <span className="eyebrow">{t("spending.allPayeesTitle", { count: detail.allPayees.length })}</span>
        </summary>
        <ul className="flex flex-col divide-y divide-line px-5 pb-3">
          {detail.allPayees.map((p) => (
            <li key={p.name}>
              <PayeeRow
                href={`${linkBase}${encodeURIComponent(p.name)}`}
                current={p.name === picked}
                left={
                  <span className="flex min-w-0 flex-col">
                    <span translate="no" className="truncate text-14 font-semibold text-ink">
                      {spendTypeLabel(t, p.name)}
                    </span>
                    <span className="text-12 text-ink-muted">{t("spending.payeeCount", { count: p.count })}</span>
                  </span>
                }
                right={
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span translate="no" className="amount text-14 font-semibold text-ink">
                      {money(p.amount)}
                    </span>
                    <span className="eyebrow">{Math.round(p.share * 100)}%</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </details>
    )}
  </section>
);

/** One payee line: a link that shows their payments on this page ("Miscellaneous" opens the one-off payments folded into it). */
const PayeeRow = ({ href, left, right, current = false }: { href: string | null; left: React.ReactNode; right: React.ReactNode; current?: boolean }) =>
  href ? (
    <Link
      href={href}
      scroll={false}
      aria-current={current ? "true" : undefined}
      className={cn("-mx-2 flex items-center justify-between gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-surface-low", current && "bg-surface-low")}
    >
      {left}
      {right}
    </Link>
  ) : (
    <div className="flex items-center justify-between gap-3 py-2">
      {left}
      {right}
    </div>
  );

/** Bars, tallest = 100%: a label under each and the amount on hover and for screen readers; one palette colour each. */
const Bars = ({ items }: { items: { label: string; amount: number; text: string }[] }) => {
  const top = Math.max(...items.map((i) => i.amount), 1);
  return (
    <ul className="flex h-36 items-end gap-2 px-4 pb-3 pt-4">
      {items.map((item, i) => (
        <li key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={item.text}>
          <span className="sr-only">{item.text}</span>
          <div
            className={cn("w-full max-w-10 rounded-t-sm", CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length])}
            style={{ height: `${Math.max((item.amount / top) * 100, item.amount ? 3 : 0)}%` }}
          />
          <span aria-hidden className="eyebrow">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
};

const Months = ({ t, locale, detail, money }: { t: Translate; locale: Locale; detail: SpendingDetail; money: (n: number) => string }) => {
  const short = dateFormat(locale, { month: "short" });
  const long = dateFormat(locale, { month: "long", year: "numeric" });
  return (
    <section className="panel" aria-labelledby="spending-months">
      <header className="panel-head">
        <h2 id="spending-months" className="eyebrow">
          {t("spending.monthsTitle")}
        </h2>
      </header>
      <Bars items={detail.months.map((m) => ({ label: short(`${m.month}-01`), amount: m.amount, text: `${long(`${m.month}-01`)}: ${money(m.amount)}` }))} />
    </section>
  );
};

const Weekdays = ({ t, locale, detail, money }: { t: Translate; locale: Locale; detail: SpendingDetail; money: (n: number) => string }) => {
  // 2026-10-05 was a Monday: the seven days from it name the weekdays in the reader's language.
  const days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(5 + i).padStart(2, "0")}`);
  const short = dateFormat(locale, { weekday: "short" });
  const long = dateFormat(locale, { weekday: "long" });
  const busiest = detail.weekdays.indexOf(Math.max(...detail.weekdays));
  return (
    <section className="panel" aria-labelledby="spending-weekdays">
      <header className="panel-head">
        <h2 id="spending-weekdays" className="eyebrow">
          {t("spending.weekdaysTitle")}
        </h2>
      </header>
      <Bars items={detail.weekdays.map((amount, i) => ({ label: short(days[i]), amount, text: `${long(days[i])}: ${money(amount)}` }))} />
      <p className="px-4 pb-3 text-13 text-ink-muted">{t("spending.weekdaysNote", { day: long(days[busiest]) })}</p>
    </section>
  );
};

const Split = ({ label, amount, count, part, total, t }: { label: string; amount: string; count: number; part: number; total: number; t: Translate }) => (
  <div className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-3">
    <p className="eyebrow">{label}</p>
    <p translate="no" className="amount text-18 font-semibold text-ink">
      {amount}
    </p>
    <p className="text-12 text-ink-muted">{t("spending.splitNote", { count, percent: `${Math.round((total ? part / total : 0) * 100)}%` })}</p>
    <div className="h-1 w-full rounded-full bg-surface-container">
      <div className="h-1 rounded-full bg-lime" style={{ width: `${total ? (part / total) * 100 : 0}%` }} />
    </div>
  </div>
);

const EntryRows = ({ entries, money, day }: { entries: DetailEntry[]; money: (n: number) => string; day: (d: string) => string }) => (
  <ul className="divide-y divide-line">
    {entries.map((e) => (
      <li key={e.id} className="flex gap-3 px-4 py-2.5 text-13">
        <span className="w-24 shrink-0 text-ink-muted">{day(e.date)}</span>
        <span translate="no" className="min-w-0 flex-1 wrap-break-word text-ink">
          {e.name}
        </span>
        <span translate="no" className="amount shrink-0 font-semibold text-ink">
          -{money(e.amount)}
        </span>
      </li>
    ))}
  </ul>
);

const EntryList = ({
  id,
  title,
  entries,
  money,
  day,
}: {
  id: string;
  title: string;
  entries: DetailEntry[];
  money: (n: number) => string;
  day: (d: string) => string;
}) => (
  <section className="panel" aria-labelledby={id}>
    <header className="panel-head">
      <h2 id={id} className="eyebrow">
        {title}
      </h2>
    </header>
    <EntryRows entries={entries} money={money} day={day} />
  </section>
);

const Tile = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <p className="eyebrow">{label}</p>
    <p translate="no" className="amount text-20 font-semibold text-ink">
      {value}
    </p>
    <p className="eyebrow">{note}</p>
  </article>
);

export default SpendingType;
