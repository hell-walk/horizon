import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, FileUp, Gem, Info, Lock } from "lucide-react";

import { BarsLoader } from "@/components/loaders";
import HeaderBox from "@/components/ui/headerBox";
import type { Locale } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { lenderDays, loadBand, nextDueAfter, type Loan, type LoanReport } from "@/lib/loans";
import { dateFormat } from "@/lib/regularText";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { loadLoanPlans, type LoanPlan } from "@/lib/server/loanPlans";
import { loanPicture } from "@/lib/server/loans";
import { currentPlan } from "@/lib/server/plan";
import { cn, formatAmount } from "@/lib/utils";

import PayoffPlanner from "../components/payoffPlanner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("loans.metaTitle"), description: t("loans.metaDescription") };
}

/** Amounts per currency, written out ("₹23,400" or "₹23,400 + $120"). */
const money = (byCurrency: Record<string, number>) =>
  Object.entries(byCurrency)
    .map(([currency, amount]) => formatAmount(Math.round(amount), currency))
    .join(" + ") || formatAmount(0, "INR");

/**
 * EMIs and loans, lender by lender. A subscriber feature: everyone else sees
 * how many lenders and how much a month, and the rest stays on the server.
 */
const Loans = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="page">
      <HeaderBox eyebrow={t("loans.eyebrow")} title={t("loans.title")} subtext={t("loans.intro")} />
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
        <LoansContent ownerId={ownerIdOf(user)} />
      </Suspense>
    </section>
  );
};

async function LoansContent({ ownerId }: { ownerId: string }) {
  const t = await getT();
  const locale = await getLocale();
  const [report, plan, plans] = await Promise.all([loanPicture(ownerId), currentPlan(), loadLoanPlans(ownerId).catch(() => ({}) as Record<string, LoanPlan>)]);

  if (report.loans.length === 0) {
    return (
      <div className="panel panel-body flex max-w-2xl flex-col gap-3">
        <p className="text-14 text-ink">{t("loans.none")}</p>
        <Link href="/upload-statement" className="btn-secondary w-fit">
          <FileUp className="size-4" aria-hidden /> {t("loans.emptyAction")}
        </Link>
      </div>
    );
  }

  if (plan?.kind !== "subscribed") return <Locked t={t} report={report} />;
  return <Analysis t={t} locale={locale} report={report} plans={plans} />;
}

/** Not subscribed: the headline only, and what subscribing shows. */
const Locked = ({ t, report }: { t: Translate; report: LoanReport }) => (
  <>
    <div className="grid gap-3 sm:grid-cols-2">
      <Tile label={t("loans.tileMonthly")} value={money(report.monthly)} note={t("loans.tileMonthlyNote", { count: report.activeCount })} />
      <Tile label={t("loans.tileLenders")} value={String(report.loans.length)} note={t("loans.tileLendersNote")} />
    </div>
    <section className="panel relative overflow-hidden" aria-labelledby="loans-locked">
      {/* A shape of what is behind the lock, drawn from nothing real. */}
      <div aria-hidden className="pointer-events-none select-none blur-sm">
        {[0.8, 0.55, 0.7].map((w, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-4">
            <div className="h-4 rounded-sm bg-surface-container" style={{ width: `${w * 40}%` }} />
            <div className="ml-auto h-4 w-20 rounded-sm bg-surface-container" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-low/70 px-6 text-center">
        <Lock className="size-5 text-ink" aria-hidden />
        <h2 id="loans-locked" className="text-16 font-semibold text-ink">
          {t("loans.lockedTitle")}
        </h2>
        <p className="max-w-md text-13 text-ink-muted">{t("loans.lockedText")}</p>
        <Link href="/plans" className="btn-accent">
          <Gem className="size-4" aria-hidden /> {t("loans.lockedAction")}
        </Link>
      </div>
    </section>
  </>
);

const Analysis = ({ t, locale, report, plans }: { t: Translate; locale: Locale; report: LoanReport; plans: Record<string, LoanPlan> }) => {
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const currencies = Object.keys(report.monthly);
  // A share of income only makes sense in one currency, with a regular income in it.
  const currency = currencies.length === 1 ? currencies[0] : null;
  const income = currency ? report.income[currency] : 0;
  const share = currency && income > 0 ? report.monthly[currency] / income : null;
  const percent = share === null ? "" : `${Math.round(share * 100)}%`;
  const band = share === null ? null : loadBand(share);
  const active = report.loans.filter((l) => l.status !== "ended");
  const ended = report.loans.filter((l) => l.status === "ended");
  const byKey = new Map(report.loans.map((l) => [l.key, l]));

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("loans.tileMonthly")} value={money(report.monthly)} note={t("loans.tileMonthlyNote", { count: report.activeCount })} />
        {share === null ? (
          <Tile label={t("loans.tileShare")} value={t("loans.tileShareUnknown")} note={t("loans.tileShareUnknownNote")} />
        ) : (
          <Tile label={t("loans.tileShare")} value={percent} note={t("loans.tileShareNote", { income: formatAmount(Math.round(income), currency!) })} />
        )}
        <Tile label={t("loans.tileBounces")} value={String(report.bounces)} note={t("loans.tileBouncesNote")} />
      </div>

      {band && (
        <p
          className={cn(
            "panel panel-body flex items-start gap-2 text-14",
            band === "ok" ? "text-ink" : band === "stretched" ? "border-warn/40 bg-warn/10 text-ink" : "border-danger/40 bg-danger-soft/40 text-ink",
          )}
        >
          {band !== "ok" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />}
          {t(`loans.band_${band}`, { percent })}
        </p>
      )}

      {report.quickCreditCount >= 2 && (
        <section className="panel panel-body flex flex-col gap-1 border-warn/40 bg-warn/10" aria-labelledby="loans-stack">
          <h2 id="loans-stack" className="flex items-center gap-2 text-14 font-semibold text-ink">
            <AlertTriangle className="size-4 text-warn-ink" aria-hidden /> {t("loans.stackTitle")}
          </h2>
          <p className="text-13 text-ink">{t("loans.stackText", { count: report.quickCreditCount })}</p>
        </section>
      )}

      {report.closeFirst.length > 1 && (
        <section className="panel" aria-labelledby="loans-order">
          <header className="panel-head">
            <h2 id="loans-order" className="eyebrow">
              {t("loans.closeTitle")}
            </h2>
          </header>
          <p className="px-4 pt-3 text-13 text-ink-muted">{t("loans.closeIntro")}</p>
          <ol className="flex flex-col gap-2 px-4 py-3">
            {report.closeFirst.map((key, i) => {
              const l = byKey.get(key)!;
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-14">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime/30 font-mono text-12 font-semibold text-ink">
                    {i + 1}
                  </span>
                  <span translate="no" className="font-semibold text-ink">
                    {l.lender}
                  </span>
                  <span className="text-13 text-ink-muted">{l.type ? t(`loans.type_${l.type}`) : t(`loans.kind_${l.kind}`)}</span>
                  <span className={cn("chip", l.cost === "high" && "border-danger/40 text-danger")}>{t(`loans.cost_${l.cost}`)}</span>
                </li>
              );
            })}
          </ol>
          <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-12 text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("loans.prepayNote")}
          </p>
        </section>
      )}

      <ul className="flex flex-col gap-3">
        {active.map((l) => (
          <LoanCard key={l.key} l={l} t={t} day={day} savedPlan={plans[l.key] ?? null} />
        ))}
      </ul>

      {ended.length > 0 && (
        <details className="panel">
          <summary className="panel-head cursor-pointer">
            <span className="eyebrow">{t("loans.endedTitle", { count: ended.length })}</span>
          </summary>
          <ul className="flex flex-col gap-3 p-3">
            {ended.map((l) => (
              <LoanCard key={l.key} l={l} t={t} day={day} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
};

// `savedPlan`: the payoff planner shows under an active loan; undefined leaves it out (closed loans).
const LoanCard = ({ l, t, day, savedPlan }: { l: Loan; t: Translate; day: (d: string) => string; savedPlan?: LoanPlan | null }) => {
  const amount = (n: number) => formatAmount(n, l.currency);
  return (
    <li className="panel flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span translate="no" className="text-16 font-semibold text-ink">
          {l.lender}
        </span>
        <span className="chip">{t(`loans.kind_${l.kind}`)}</span>
        {l.type && l.type !== "payLater" && <span className="chip">{t(`loans.type_${l.type}`)}</span>}
        <span translate="no" className="amount ml-auto text-16 font-semibold text-danger">
          {t(l.steady ? "loans.perMonth" : "loans.perMonthAbout", { amount: amount(l.monthly) })}
        </span>
      </div>
      <p className={cn("text-13", l.status === "missed" ? "text-warn-ink" : "text-ink-muted")}>
        {t(`loans.status_${l.status}`)}
        {l.status === "active" &&
          (savedPlan?.dueDay && (!l.next || l.nextLikely)
            ? ` · ${t("loans.nextDue", { date: day(nextDueAfter(l.last, savedPlan.dueDay)) })}`
            : l.next
              ? ` · ${t(l.nextLikely ? "loans.nextLikely" : "loans.nextDue", { date: day(l.next) })}`
              : "")}
      </p>
      <p className="text-13 text-ink">{t("loans.paidSince", { count: l.count, amount: amount(l.paid), date: day(l.first) })}</p>
      {l.borrowed > 0 && <p className="text-13 text-ink-muted">{t("loans.borrowed", { amount: amount(l.borrowed) })}</p>}
      {l.bounces > 0 && (
        <p className="flex items-center gap-1.5 text-13 text-danger">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {t("loans.bounceNote", { count: l.bounces, amount: amount(l.bounceCharges) })}
        </p>
      )}
      <details>
        <summary className="w-fit cursor-pointer text-13 font-semibold text-ink underline underline-offset-2">
          {t("loans.entries", { count: l.entries.length })}
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {l.entries.map((e) => (
            <li key={e.id} className="flex gap-3 text-13">
              <span className="w-24 shrink-0 text-ink-muted">{day(e.date)}</span>
              <span translate="no" className="min-w-0 flex-1 wrap-break-word text-ink">
                {e.name}
              </span>
              <span translate="no" className="amount shrink-0 text-ink">
                -{amount(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      </details>
      {savedPlan !== undefined && l.status === "active" && (
        <PayoffPlanner loanKey={l.key} emi={l.monthly} currency={l.currency} saved={savedPlan} {...lenderDays(l.lender)} />
      )}
    </li>
  );
};

const Tile = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <p className="eyebrow">{label}</p>
    <p translate="no" className="amount text-20 font-semibold text-ink">
      {value}
    </p>
    <p className="eyebrow">{note}</p>
  </article>
);

export default Loans;
