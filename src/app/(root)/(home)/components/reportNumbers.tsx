import { ArrowUpRight, FileText } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/finance/regularText";
import { reportForOwner } from "@/lib/server/report";
import { cn, formatAmount } from "@/lib/utils";

/** The latest full month in three numbers, as a panel beside the balance and the income; opens the report. */
const ReportNumbers = async ({ ownerId }: { ownerId: string }) => {
  const { report, currency } = await reportForOwner(ownerId).catch(() => ({ report: null, months: [], currency: "INR" }));
  if (!report) return null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const monthName = dateFormat(locale, { month: "long", year: "numeric" });
  const money = (n: number) => formatAmount(Math.round(n), currency);

  return (
    <section className="panel flex flex-col" aria-labelledby="report-numbers">
      <header className="panel-head">
        <h2 id="report-numbers" className="eyebrow flex items-center gap-2">
          <FileText className="size-3.5" aria-hidden /> {monthName(`${report.month}-01`)}
        </h2>
        <Link href={`/report?month=${report.month}`} className="btn-ghost btn-sm">
          {t("report.teaserOpen")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <dl className="flex flex-1 flex-col justify-center gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-13 text-ink-muted">{t("report.tileIn")}</dt>
          <dd translate="no" className="amount text-16 font-semibold text-ink">
            {money(report.moneyIn)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-13 text-ink-muted">{t("report.tileOut")}</dt>
          <dd translate="no" className="amount text-16 font-semibold text-ink">
            {money(report.spent)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-13 text-ink-muted">{t("report.tileKept")}</dt>
          <dd translate="no" className={cn("amount text-16 font-semibold", report.kept < 0 ? "text-danger" : "text-ink")}>
            {money(report.kept)}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default ReportNumbers;
