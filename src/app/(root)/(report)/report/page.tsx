import type { Metadata } from "next";
import { Gem, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import HealthPanel from "../components/healthPanel";

import { BarsLoader } from "@/components/ui/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { chartColorClass, spendTypeLabel } from "@/constants";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/finance/regularText";
import type { Report } from "@/lib/finance/report";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { currentPlan } from "@/lib/server/plan";
import { reportForOwner } from "@/lib/server/report";
import { cn, formatAmount } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("report.metaTitle"), description: t("report.metaDescription") };
}

/**
 * The monthly report: the latest full month the statements cover, or the one
 * picked. The headline (in, out, kept) for everyone; where it went, the
 * biggest payments, EMIs, charges, changes and next month for subscribers.
 */
const ReportPage = async ({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) => {
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const { month } = await searchParams;
  const t = await getT();

  return (
    <section className="page">
      <HeaderBox eyebrow={t("report.eyebrow")} title={t("report.title")} subtext={t("report.subtext")} />
      <Suspense
        fallback={
          <div className="panel">
            <BarsLoader className="h-64" />
          </div>
        }
      >
        <ReportContent ownerId={ownerIdOf(user)} month={typeof month === "string" ? month : undefined} />
      </Suspense>
    </section>
  );
};

async function ReportContent({ ownerId, month }: { ownerId: string; month?: string }) {
  const [t, locale, plan, { report, months, currency }] = await Promise.all([getT(), getLocale(), currentPlan(), reportForOwner(ownerId, month)]);
  const monthName = dateFormat(locale, { month: "long", year: "numeric" });
  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const money = (n: number) => formatAmount(Math.round(n), currency);
  const subscribed = plan?.kind === "subscribed";

  if (!report) {
    return (
      <div className="panel panel-body flex max-w-2xl flex-col gap-3">
        <p className="text-14 text-ink">{t("report.empty")}</p>
        <Link href="/upload-statement" className="btn-secondary w-fit">
          {t("home.actionUpload")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <nav aria-label={t("report.pickMonth")} className="flex flex-wrap gap-2">
        {months.slice(0, 12).map((m) => (
          <Link
            key={m}
            href={`/report?month=${m}`}
            className={cn("chip", m === report.month && "border-primary bg-primary text-primary-foreground")}
            aria-current={m === report.month ? "page" : undefined}
          >
            {monthName(`${m}-01`)}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("report.tileIn")} value={money(report.moneyIn)} note={t("report.tileInNote")} />
        <Tile label={t("report.tileOut")} value={money(report.spent)} note={t("report.tileOutNote", { count: report.count })} />
        <Tile
          label={t("report.tileKept")}
          value={money(report.kept)}
          note={
            report.keptRate === null
              ? t("report.tileKeptNoIncome")
              : t("report.tileKeptNote", { percent: `${Math.round(report.keptRate * 100)}%`, invested: money(report.invested) })
          }
          warn={report.kept < 0}
        />
      </div>

      {!subscribed ? (
        <div className="panel panel-body flex flex-col gap-3">
          <p className="flex items-start gap-2 text-14 text-ink">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("report.lockedTitle")}</span>
          </p>
          <p className="text-13 text-ink-muted">{t("report.lockedText")}</p>
          <Link href="/plans" className="btn-primary w-fit">
            <Gem className="size-4" aria-hidden /> {t("home.checksSeePlans")}
          </Link>
        </div>
      ) : (
        <Details report={report} t={t} money={money} day={day} monthName={monthName} />
      )}

      {/* The health score and its five parts (the parts for subscribers): the ring on Home opens here. */}
      <Suspense fallback={null}>
        <HealthPanel ownerId={ownerId} />
      </Suspense>
    </>
  );
}

const Details = ({
  report,
  t,
  money,
  day,
  monthName,
}: {
  report: Report;
  t: Translate;
  money: (n: number) => string;
  day: (d: string) => string;
  monthName: (d: string) => string;
}) => {
  const spentTotal = report.byType.reduce((s, b) => s + b.amount, 0);
  const nextName = (() => {
    const [y, m] = report.month.split("-").map(Number);
    return monthName(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`);
  })();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t("report.whereTitle")}>
        <ul className="flex flex-col divide-y divide-line">
          {report.byType.map((b, i) => (
            <li key={b.name} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn("size-2.5 shrink-0 rounded-sm", chartColorClass(b.name, i))} />
                <span className="truncate text-14 font-semibold text-ink">{spendTypeLabel(t, b.name)}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span translate="no" className="amount text-14 font-semibold text-ink">
                  {money(b.amount)}
                </span>
                <span className="eyebrow">{spentTotal ? Math.round((b.amount / spentTotal) * 100) : 0}%</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t("report.biggestTitle")}>
        <ul className="flex flex-col divide-y divide-line">
          {report.biggest.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 flex-col">
                <span translate="no" className="truncate text-14 font-semibold text-ink">
                  {p.name}
                </span>
                <span className="text-12 text-ink-muted">
                  {day(p.date)} · {spendTypeLabel(t, p.type)}
                </span>
              </span>
              <span translate="no" className="amount shrink-0 text-14 font-semibold text-ink">
                {money(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t("report.commitTitle")}>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label={t("report.emis", { count: report.emis.count })} value={money(report.emis.amount)} />
          <Fact label={t("report.charges", { count: report.charges.count })} value={money(report.charges.amount)} warn={report.charges.count > 0} />
        </dl>
        {report.changes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            {report.changes.map((r) => (
              <li key={r.key} className="text-13 text-ink">
                <span translate="no" className="font-semibold">
                  {r.name}
                </span>
                :{" "}
                {r.status === "stopped"
                  ? t("report.changeStopped")
                  : r.status === "missed"
                    ? t("report.changeMissed")
                    : t("report.changeAmount", { from: money(r.changed!.from), to: money(r.changed!.to) })}
              </li>
            ))}
          </ul>
        )}
        {report.changes.length === 0 && <p className="mt-3 text-13 text-ink-muted">{t("report.noChanges")}</p>}
      </Panel>

      <Panel title={t("report.nextTitle", { month: nextName })}>
        {report.nextMonth.length === 0 ? (
          <p className="text-13 text-ink-muted">{t("report.nextNone")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {report.nextMonth.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span translate="no" className="truncate text-14 font-semibold text-ink">
                    {d.name}
                  </span>
                  <span className="text-12 text-ink-muted">
                    {day(d.date)} · {t(`bills.kind_${d.kind}`)}
                    {d.confidence === "low" && <> · {t("calendar.estimated")}</>}
                  </span>
                </span>
                <span translate="no" className={cn("amount shrink-0 text-14 font-semibold", d.amount < 0 ? "text-ink" : "text-success")}>
                  {d.amount < 0 ? "−" : "+"}
                  {money(Math.abs(d.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-12 text-ink-muted">
          <Link href="/calendar" className="underline underline-offset-4">
            {t("report.seeCalendar")}
          </Link>
        </p>
      </Panel>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="panel">
    <header className="panel-head">
      <span className="eyebrow">{title}</span>
    </header>
    <div className="panel-body">{children}</div>
  </section>
);

const Tile = ({ label, value, note, warn = false }: { label: string; value: string; note: string; warn?: boolean }) => (
  <div className="panel flex flex-col gap-1 p-4">
    <span className="eyebrow">{label}</span>
    <span translate="no" className={cn("amount text-20 font-semibold", warn ? "text-danger" : "text-ink")}>
      {value}
    </span>
    <span className="text-12 text-ink-muted">{note}</span>
  </div>
);

const Fact = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
  <div className="flex flex-col">
    <dt className="eyebrow">{label}</dt>
    <dd translate="no" className={cn("amount text-16 font-semibold", warn ? "text-warn-ink" : "text-ink")}>
      {value}
    </dd>
  </div>
);

export default ReportPage;
