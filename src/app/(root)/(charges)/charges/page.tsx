import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp, Info } from "lucide-react";

import { BarsLoader } from "@/components/loaders";
import HeaderBox from "@/components/ui/headerBox";
import type { ChargeGroup } from "@/lib/charges";
import { reversalRequest } from "@/lib/chargesLetter";
import type { Locale } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/regularText";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { bankCharges, type AccountCharges } from "@/lib/server/charges";
import { formatAmount, maskLabel } from "@/lib/utils";

import RequestLetter from "../components/requestLetter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("charges.metaTitle"), description: t("charges.metaDescription") };
}

/** Totals per currency, written out ("₹1,860" or "₹1,860 + $12"). */
const perCurrency = (items: AccountCharges[], pick: (a: AccountCharges) => number) => {
  const totals = new Map<string, number>();
  for (const a of items) totals.set(a.account.currency, (totals.get(a.account.currency) ?? 0) + pick(a));
  return [...totals.entries()].map(([currency, amount]) => formatAmount(amount, currency)).join(" + ") || formatAmount(0, "INR");
};

/**
 * Bank charges: what the banks themselves took in the last 12 months the
 * statements cover, by kind, with how to avoid each and a ready request to
 * ask for them back.
 */
const Charges = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="page">
      <HeaderBox eyebrow={t("charges.eyebrow")} title={t("charges.title")} subtext={t("charges.intro")} />
      <Suspense
        fallback={
          <>
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
        <ChargesContent ownerId={ownerIdOf(user)} holder={[user.firstName, user.lastName].filter(Boolean).join(" ")} />
      </Suspense>
    </section>
  );
};

async function ChargesContent({ ownerId, holder }: { ownerId: string; holder: string }) {
  const t = await getT();
  const locale = await getLocale();
  const all = await bankCharges(ownerId);

  if (all.length === 0) {
    return (
      <div className="panel panel-body flex max-w-2xl flex-col gap-3">
        <p className="text-14 text-ink">{t("charges.empty")}</p>
        <Link href="/upload-statement" className="btn-secondary w-fit">
          <FileUp className="size-4" aria-hidden /> {t("charges.emptyAction")}
        </Link>
      </div>
    );
  }

  const charged = all.filter((a) => a.report.count > 0);
  const months = Math.max(...all.map((a) => a.report.months));
  const count = charged.reduce((s, a) => s + a.report.count, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("charges.tileTotal")} value={perCurrency(all, (a) => a.report.total)} note={t("charges.tileTotalNote", { count })} />
        <Tile
          label={t("charges.tileMonth")}
          value={perCurrency(all, (a) => (a.report.total - a.report.refunded) / a.report.months)}
          note={t("charges.tileMonthNote", { count: months })}
        />
        <Tile label={t("charges.tileBack")} value={perCurrency(all, (a) => a.report.refunded)} note={t("charges.tileBackNote")} />
      </div>

      {charged.length === 0 ? (
        <div className="panel panel-body max-w-2xl">
          <p className="text-14 text-ink">{t("charges.none", { count: months })}</p>
        </div>
      ) : (
        charged.map((a) => <AccountSection key={a.account.id} a={a} t={t} locale={locale} holder={holder} />)
      )}

      <p className="flex max-w-3xl items-start gap-2 text-13 text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("charges.ombudsman")}
      </p>
    </>
  );
}

const AccountSection = ({ a, t, locale, holder }: { a: AccountCharges; t: Translate; locale: Locale; holder: string }) => {
  const id = `charges-${a.account.id}`;
  const fullDay = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const money = (n: number) => formatAmount(n, a.account.currency);

  return (
    <section className="panel" aria-labelledby={id}>
      <header className="panel-head flex-wrap gap-2">
        <h2 id={id} className="eyebrow">
          <span translate="no">
            {a.account.name} {maskLabel(a.account.mask)}
          </span>
        </h2>
        <span translate="no" className="amount text-14 font-semibold text-danger">
          -{money(a.report.total)}
        </span>
      </header>
      <p className="px-4 pt-3 text-12 text-ink-muted">{t("charges.coverNote", { from: fullDay(a.report.from), to: fullDay(a.report.to) })}</p>
      <ul className="divide-y divide-line">
        {a.report.groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <GroupItem key={g.kind} g={g} t={t} money={money} day={fullDay} />
          ))}
      </ul>
      {/* Nothing to ask for when the bank has already given every kind back. */}
      {a.report.groups.some((g) => g.count > 0 && g.refunded < g.amount) && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-3 text-14 font-semibold text-ink">{t("charges.askTitle", { bank: a.account.name })}</summary>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <p className="text-13 text-ink-muted">{t("charges.askIntro")}</p>
            <RequestLetter text={reversalRequest({ bank: a.account.name, mask: a.account.mask, currency: a.account.currency, report: a.report, holder })} />
          </div>
        </details>
      )}
    </section>
  );
};

const GroupItem = ({ g, t, money, day }: { g: ChargeGroup; t: Translate; money: (n: number) => string; day: (d: string) => string }) => (
  <li className="flex flex-col gap-1.5 px-4 py-3">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-14 font-semibold text-ink">{t(`charges.kind_${g.kind}`)}</span>
      <span className="chip">{t("charges.times", { count: g.count })}</span>
      <span translate="no" className="amount ml-auto text-14 font-semibold text-danger">
        -{money(g.amount)}
      </span>
    </div>
    <p className="text-13 text-ink-muted">{t(`charges.tip_${g.kind}`)}</p>
    {g.refunded > 0 && <p className="text-13 text-success">{t("charges.refundedNote", { amount: money(g.refunded) })}</p>}
    <details>
      <summary className="w-fit cursor-pointer text-13 font-semibold text-ink underline underline-offset-2">{t("charges.entries", { count: g.count })}</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {g.entries.map((e) => (
          <li key={e.id} className="flex gap-3 text-13">
            <span className="w-24 shrink-0 text-ink-muted">{day(e.date)}</span>
            <span translate="no" className="min-w-0 flex-1 wrap-break-word text-ink">
              {e.name}
            </span>
            <span translate="no" className="amount shrink-0 text-ink">
              -{money(e.amount)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  </li>
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

export default Charges;
