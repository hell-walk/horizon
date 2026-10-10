import { Lightbulb, TrendingDown, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";

import { dataLabel } from "@/lib/i18n/labels";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import type { Evidence, Insight, Insights } from "@/lib/insights";
import { dateFormat } from "@/lib/regularText";
import { formatAmount } from "@/lib/utils";

/**
 * "What changed": each finding in a sentence, how the usual was worked out,
 * and the entries behind it. Nothing here is a guess the user cannot check.
 */
const InsightsPanel = async ({ result, currency, compact = false, href }: { result: Insights; currency?: string; compact?: boolean; href?: string }) => {
  const t = await getT();
  const locale = await getLocale();
  const monthName = dateFormat(locale, { month: "long", year: "numeric" });
  const month = (m: string) => monthName(`${m}-01`);
  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const money = (n: number) => formatAmount(Math.abs(n), currency);

  if (!result.ok) {
    if (compact) return null; // Home stays quiet until there is something to say
    return (
      <section className="panel" id="insights">
        <Header t={t} title={t("insights.title")} />
        <p className="px-4 py-3 text-14 text-ink-muted">{t("insights.tooLittle")}</p>
      </section>
    );
  }

  const shown = compact ? result.insights.slice(0, 3) : result.insights;
  return (
    <section className="panel scroll-mt-6" id="insights">
      <Header t={t} title={t("insights.titleMonth", { month: month(result.month) })} />
      {shown.length === 0 ? (
        <p className="px-4 py-3 text-14 text-ink-muted">{t("insights.nothing", { month: month(result.month) })}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((insight, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <Icon insight={insight} />
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-14">
                <p className="text-ink">{sentence(t, insight, money, month)}</p>
                <p className="text-13 text-ink-muted">{explanation(t, insight, money, month)}</p>
                {"entries" in insight && insight.entries.length > 0 && (
                  <Entries t={t} entries={insight.entries} count={insight.count} money={money} day={day} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {compact && href && result.insights.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-13">
          <Link href={href} className="font-semibold text-ink underline underline-offset-2">
            {result.insights.length > shown.length ? t("insights.seeAll", { count: result.insights.length }) : t("insights.seeMore")}
          </Link>
        </p>
      )}
    </section>
  );
};

const Header = ({ t, title }: { t: Translate; title: string }) => (
  <header className="panel-head">
    <h2 className="eyebrow flex items-center gap-2 text-ink">
      <Lightbulb className="size-3.5" aria-hidden /> {title}
    </h2>
    <span className="eyebrow">{t("insights.vsUsual")}</span>
  </header>
);

const Icon = ({ insight }: { insight: Insight }) => {
  const up = insight.kind === "categoryUp" || insight.kind === "keptLess";
  const Glyph = insight.kind === "newPayee" ? UserPlus : up ? TrendingUp : TrendingDown;
  const tone = insight.kind === "newPayee" ? "text-ink-muted" : insight.kind === "categoryUp" || insight.kind === "keptLess" ? "text-danger" : "text-success";
  return <Glyph className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />;
};

function sentence(t: Translate, i: Insight, money: (n: number) => string, month: (m: string) => string) {
  switch (i.kind) {
    case "categoryUp":
    case "categoryDown":
      return t(i.kind === "categoryUp" ? "insights.categoryUp" : "insights.categoryDown", {
        category: dataLabel(t, i.category),
        amount: money(i.amount),
        month: month(i.month),
        difference: money(i.difference),
      });
    case "newPayee":
      return t("insights.newPayee", { payee: i.payee, amount: money(i.amount), month: month(i.month) });
    case "keptLess":
    case "keptMore": {
      const kept = `${i.kept < 0 ? "-" : ""}${money(i.kept)}`;
      return t(i.kind === "keptLess" ? "insights.keptLess" : "insights.keptMore", { kept, month: month(i.month), difference: money(i.difference) });
    }
  }
}

function explanation(t: Translate, i: Insight, money: (n: number) => string, month: (m: string) => string) {
  const months = (list: { month: string }[]) => list.map((b) => month(b.month)).join(", ");
  switch (i.kind) {
    case "categoryUp":
    case "categoryDown":
      return t("insights.usualFrom", { usual: money(i.usual), months: months(i.basis) });
    case "newPayee":
      return t("insights.newPayeeWhy");
    case "keptLess":
    case "keptMore": {
      // Which side moved: a change smaller than a tenth of the difference counts as "about the same".
      const small = (n: number) => Math.abs(n) < Math.abs(i.difference) * 0.1;
      const spending = small(i.spendingChange) ? null : i.spendingChange > 0 ? "spendingUp" : "spendingDown";
      const income = small(i.incomeChange) ? null : i.incomeChange > 0 ? "incomeUp" : "incomeDown";
      const why =
        spending && income
          ? t(`insights.why_${spending}_${income}`, { spending: money(i.spendingChange), income: money(i.incomeChange) })
          : spending
            ? t(`insights.why_${spending}`, { spending: money(i.spendingChange) })
            : income
              ? t(`insights.why_${income}`, { income: money(i.incomeChange) })
              : "";
      return `${why} ${t("insights.usualKeptFrom", { usual: money(i.usualKept), months: months(i.basis) })}`.trim();
    }
  }
}

const Entries = ({
  t,
  entries,
  count,
  money,
  day,
}: {
  t: Translate;
  entries: Evidence[];
  count: number;
  money: (n: number) => string;
  day: (d: string) => string;
}) => (
  <details className="text-13">
    <summary className="cursor-pointer text-ink-muted underline underline-offset-2">{t("insights.seeEntries", { count })}</summary>
    <ul className="mt-1 flex flex-col gap-0.5" translate="no">
      {entries.map((e) => (
        <li key={e.id} className="flex justify-between gap-3 text-12 text-ink-muted">
          <span className="min-w-0 truncate">
            <span className="font-mono">{day(e.date)}</span> · {e.name}
          </span>
          <span className="amount shrink-0">{money(e.amount)}</span>
        </li>
      ))}
    </ul>
    {count > entries.length && <p className="text-12 text-ink-muted">{t("insights.moreEntries", { count: count - entries.length })}</p>}
  </details>
);

export default InsightsPanel;
