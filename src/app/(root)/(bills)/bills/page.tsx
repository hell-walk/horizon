import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, FileUp } from "lucide-react";

import HeaderBox from "@/components/ui/headerBox";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { regularPayments, type RegularWithAccount } from "@/lib/server/regular";
import { formatAmount } from "@/lib/utils";

import { dateFormat, daysUntil } from "@/lib/regularText";

import RegularItem from "../components/regularItem";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("bills.metaTitle"), description: t("bills.metaDescription") };
}

const SOON_DAYS = 30;

/** Monthly totals per currency, written out ("₹42,000" or "₹42,000 + $120"). */
const perMonth = (items: RegularWithAccount[]) => {
  const totals = new Map<string, number>();
  for (const r of items) totals.set(r.account.currency, (totals.get(r.account.currency) ?? 0) + r.perMonth);
  return [...totals.entries()].map(([currency, amount]) => formatAmount(Math.round(amount), currency)).join(" + ") || formatAmount(0, "INR");
};

/**
 * Bills and regular payments: what comes back every week, month or year,
 * found in the user's own entries, with what is coming up next.
 */
const Bills = async () => {
  const t = await getT();
  const locale = await getLocale();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  const all = await regularPayments(ownerIdOf(user));
  // Still going: due next, or due already but past where the statements end. Only these
  // count in the totals and in "coming up"; a payment that did not come is a question, not a bill.
  const current = all.filter((r) => r.status === "upcoming" || r.status === "unseen");
  const missed = all.filter((r) => r.status === "missed");
  const out = current.filter((r) => r.direction === "out" && r.kind !== "own");
  const income = current.filter((r) => r.direction === "in" && r.kind !== "own");
  const own = current.filter((r) => r.kind === "own");
  const soon = current.filter((r) => r.direction === "out" && daysUntil(r.next) <= SOON_DAYS);
  const outAll = [...out, ...missed.filter((r) => r.direction === "out" && r.kind !== "own")];
  const alerts = all.filter((r) => r.changed || r.status === "missed");
  const stopped = all.filter((r) => r.status === "stopped");
  const day = dateFormat(locale, { day: "numeric", month: "short" });

  return (
    <section className="page">
      <HeaderBox eyebrow={t("bills.eyebrow")} title={t("bills.title")} subtext={t("bills.intro")} />

      {all.length === 0 ? (
        <div className="panel panel-body flex max-w-2xl flex-col gap-3">
          <p className="text-14 text-ink">{t("bills.empty")}</p>
          <Link href="/connect-bank" className="btn-secondary w-fit">
            <FileUp className="size-4" aria-hidden /> {t("bills.emptyAction")}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={t("bills.tileOut")} value={perMonth(out)} note={t("bills.tileOutNote", { count: out.length })} />
            <Tile label={t("bills.tileIn")} value={perMonth(income)} note={t("bills.tileInNote", { count: income.length })} />
            <Tile
              label={t("bills.tileSoon")}
              value={perMonth(soon.map((r) => ({ ...r, perMonth: r.amount })))}
              note={t("bills.tileSoonNote", { count: soon.length })}
            />
          </div>
          <p className="text-12 text-ink-muted">{t("bills.estimateNote")}</p>

          {alerts.length > 0 && (
            <section className="panel" aria-labelledby="bills-alerts">
              <header className="panel-head">
                <h2 id="bills-alerts" className="eyebrow flex items-center gap-2 text-ink">
                  <AlertTriangle className="size-3.5 text-warn-ink" aria-hidden /> {t("bills.alertsTitle")}
                </h2>
              </header>
              <ul className="divide-y divide-line">
                {alerts.map((r) => (
                  <li key={r.key} className="px-4 py-3 text-14 text-ink">
                    <span translate="no" className="font-semibold">
                      {r.name}
                    </span>
                    : {alertText(t, r, day)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <List id="bills-soon" title={t("bills.soonTitle", { days: SOON_DAYS })} empty={t("bills.soonEmpty")} items={soon} t={t} locale={locale} showDate />
          {income.length > 0 && <List id="bills-income" title={t("bills.incomeTitle")} items={income} t={t} locale={locale} />}
          <List id="bills-all" title={t("bills.allTitle")} empty={t("bills.allEmpty")} items={outAll} t={t} locale={locale} />
          {own.length > 0 && <List id="bills-own" title={t("bills.ownTitle")} items={own} t={t} locale={locale} />}

          {stopped.length > 0 && (
            <details className="panel">
              <summary className="panel-head cursor-pointer">
                <span className="eyebrow text-ink">{t("bills.stoppedTitle", { count: stopped.length })}</span>
              </summary>
              <ul className="divide-y divide-line">
                {stopped.map((r) => (
                  <RegularItem key={r.key} r={r} t={t} locale={locale} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
};

const alertText = (t: Translate, r: RegularWithAccount, day: (d: string) => string) => {
  const money = (n: number) => formatAmount(n, r.account.currency);
  if (r.changed) return t(r.changed.to > r.changed.from ? "bills.changedUp" : "bills.changedDown", { from: money(r.changed.from), to: money(r.changed.to) });
  return t("bills.whenMissed", { date: day(r.missedSince ?? r.next) });
};

const List = ({
  id,
  title,
  empty,
  items,
  t,
  locale,
  showDate = false,
}: {
  id: string;
  title: string;
  empty?: string;
  items: RegularWithAccount[];
  t: Translate;
  locale: Awaited<ReturnType<typeof getLocale>>;
  showDate?: boolean;
}) => (
  <section className="panel" aria-labelledby={id}>
    <header className="panel-head">
      <h2 id={id} className="eyebrow text-ink">
        {title}
      </h2>
    </header>
    {items.length === 0 ? (
      <p className="px-4 py-3 text-14 text-ink-muted">{empty}</p>
    ) : (
      <ul className="divide-y divide-line">
        {items.map((r) => (
          <RegularItem key={r.key} r={r} t={t} locale={locale} showDate={showDate} />
        ))}
      </ul>
    )}
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

export default Bills;
