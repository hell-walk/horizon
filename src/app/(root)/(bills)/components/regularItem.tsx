import { CalendarClock, TrendingDown, TrendingUp } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat, whenText } from "@/lib/regularText";
import type { RegularWithAccount } from "@/lib/server/regular";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

/**
 * One regular payment: who, how much, how often, when next, from which
 * account, and the payments it was found from ("Why we think so").
 */
const RegularItem = ({ r, t, locale, showDate = false }: { r: RegularWithAccount; t: Translate; locale: Locale; showDate?: boolean }) => {
  const day = dateFormat(locale, { day: "numeric", month: "short" });
  const fullDay = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const weekday = dateFormat(locale, { weekday: "short" });
  const money = (n: number) => formatAmount(n, r.account.currency);
  const late = r.status === "missed" || r.status === "stopped";
  const first = r.seen[r.seen.length - 1];

  return (
    <li className="flex gap-3 px-4 py-3">
      {showDate && (
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center justify-center rounded-md border py-1.5",
            late || r.status === "unseen" ? "border-warn/40 bg-warn/10" : "border-line bg-card",
          )}
        >
          <span className="eyebrow">{weekday(r.next)}</span>
          <span className="font-display text-18 font-semibold text-ink">{Number(r.next.slice(8))}</span>
          <span className="eyebrow">{dateFormat(locale, { month: "short" })(r.next)}</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span translate="no" className="min-w-0 break-words text-14 font-semibold text-ink">
            {r.name}
          </span>
          <span className="chip">{t(`bills.kind_${r.kind}`)}</span>
          <span translate="no" className={cn("amount ml-auto text-14 font-semibold", r.direction === "out" ? "text-danger" : "text-success")}>
            {r.fixedAmount ? "" : `${t("bills.about")} `}
            {r.direction === "out" ? "-" : "+"}
            {money(r.amount)}
          </span>
        </div>

        <p className="text-13 text-ink-muted">
          {t(`bills.cadence_${r.cadence}`)} ·{" "}
          <span translate="no">
            {r.account.name} {maskLabel(r.account.mask)}
          </span>
        </p>

        <p className={cn("flex items-center gap-1.5 text-13", late || r.status === "unseen" ? "text-warn-ink" : "text-ink")}>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden /> {whenText(t, r, day)}
        </p>

        {r.changed && (
          <p className="flex items-center gap-1.5 text-13 text-ink">
            {r.changed.to > r.changed.from ? (
              <TrendingUp className="size-3.5 text-danger" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5 text-success" aria-hidden />
            )}
            {t(r.changed.to > r.changed.from ? "bills.changedUp" : "bills.changedDown", { from: money(r.changed.from), to: money(r.changed.to) })}
          </p>
        )}

        <details className="text-13">
          <summary className="cursor-pointer text-ink-muted underline underline-offset-2">
            {r.count === 1 ? t("bills.whySeenOnce") : r.confidence === "low" ? t("bills.whySeenTwice") : t("bills.why", { count: r.count, since: fullDay(first.date) })}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 pl-1" translate="no">
            {r.seen.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 font-mono text-12 text-ink-muted">
                <span>{fullDay(s.date)}</span>
                <span className="amount">{money(s.amount)}</span>
              </li>
            ))}
          </ul>
          {r.count > r.seen.length && <p className="text-12 text-ink-muted">{t("bills.andMore", { count: r.count - r.seen.length })}</p>}
        </details>
      </div>
    </li>
  );
};

export default RegularItem;
