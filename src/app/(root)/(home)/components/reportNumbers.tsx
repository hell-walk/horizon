import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/regularText";
import { reportForOwner } from "@/lib/server/report";
import { cn, formatAmount } from "@/lib/utils";

/** The latest full month in three numbers, in the overview beside the accounts; opens the report. */
const ReportNumbers = async ({ ownerId }: { ownerId: string }) => {
  const { report, currency } = await reportForOwner(ownerId).catch(() => ({ report: null, months: [], currency: "INR" }));
  if (!report) return null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const monthName = dateFormat(locale, { month: "long", year: "numeric" });
  const money = (n: number) => formatAmount(Math.round(n), currency);

  return (
    <Link href={`/report?month=${report.month}`} className="flex flex-col gap-2 rounded-md p-2 transition-colors hover:bg-surface-low">
      <span className="eyebrow">{monthName(`${report.month}-01`)}</span>
      <dl className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-12 text-ink-muted">{t("report.tileIn")}</dt>
          <dd translate="no" className="amount text-14 font-semibold text-ink">
            {money(report.moneyIn)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-12 text-ink-muted">{t("report.tileOut")}</dt>
          <dd translate="no" className="amount text-14 font-semibold text-ink">
            {money(report.spent)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-12 text-ink-muted">{t("report.tileKept")}</dt>
          <dd translate="no" className={cn("amount text-14 font-semibold", report.kept < 0 ? "text-danger" : "text-ink")}>
            {money(report.kept)}
          </dd>
        </div>
      </dl>
    </Link>
  );
};

export default ReportNumbers;
