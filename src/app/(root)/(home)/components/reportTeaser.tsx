import { ArrowUpRight, FileText } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import { reportForOwner } from "@/lib/server/report";
import { cn, formatAmount } from "@/lib/utils";

/** Home's line about the latest month's report: in, out, kept, and the way to the whole thing. */
const ReportTeaser = async ({ ownerId }: { ownerId: string }) => {
  const { report, currency } = await reportForOwner(ownerId).catch(() => ({ report: null, months: [], currency: "INR" }));
  if (!report) return null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const monthName = dateFormat(locale, { month: "long", year: "numeric" });
  const money = (n: number) => formatAmount(Math.round(n), currency);

  return (
    <section className="panel" aria-labelledby="report-teaser">
      <header className="panel-head">
        <h2 id="report-teaser" className="eyebrow flex items-center gap-2">
          <FileText className="size-3.5" aria-hidden /> {t("report.teaserTitle", { month: monthName(`${report.month}-01`) })}
        </h2>
        <Link href={`/report?month=${report.month}`} className="btn-ghost btn-sm">
          {t("report.teaserOpen")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <dl className="grid grid-cols-3 gap-3 px-4 py-3">
        <div className="flex flex-col">
          <dt className="eyebrow">{t("report.tileIn")}</dt>
          <dd translate="no" className="amount text-16 font-semibold text-ink">
            {money(report.moneyIn)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="eyebrow">{t("report.tileOut")}</dt>
          <dd translate="no" className="amount text-16 font-semibold text-ink">
            {money(report.spent)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="eyebrow">{t("report.tileKept")}</dt>
          <dd translate="no" className={cn("amount text-16 font-semibold", report.kept < 0 ? "text-danger" : "text-ink")}>
            {money(report.kept)}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default ReportTeaser;
