import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { regularPayments } from "@/lib/server/regular";
import { dateFormat, daysUntil, whenText } from "@/lib/regularText";
import { cn, formatAmount } from "@/lib/utils";

const DAYS = 14;
const SHOWN = 3;

/**
 * Home's "Coming up": the next regular payments in the next two weeks, from
 * all accounts, with a link to every bill. Shows nothing until a payment has
 * repeated, so a new user is not shown an empty box.
 */
const ComingUp = async ({ ownerId }: { ownerId: string }) => {
  const all = await regularPayments(ownerId);
  const soon = all.filter((r) => r.direction === "out" && r.status !== "stopped" && r.status !== "missed" && daysUntil(r.next) <= DAYS);
  if (all.length === 0) return null;

  const t = await getT();
  const locale = await getLocale();
  const day = dateFormat(locale, { day: "numeric", month: "short" });

  return (
    <section className="panel" aria-labelledby="coming-up">
      <header className="panel-head">
        <h2 id="coming-up" className="eyebrow flex items-center gap-2 text-ink">
          <CalendarClock className="size-3.5" aria-hidden /> {t("bills.homeTitle", { days: DAYS })}
        </h2>
        <Link href="/bills" className="btn-ghost btn-sm">
          {t("bills.homeSeeAll")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      {soon.length === 0 ? (
        <p className="px-4 py-3 text-14 text-ink-muted">{t("bills.homeNothing", { days: DAYS })}</p>
      ) : (
        <ul className="divide-y divide-line">
          {soon.slice(0, SHOWN).map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span translate="no" className="truncate text-14 font-semibold text-ink">
                  {r.name}
                </span>
                <span className={cn("text-12", r.status === "unseen" ? "text-warn-ink" : "text-ink-muted")}>{whenText(t, r, day)}</span>
              </div>
              <span translate="no" className="amount shrink-0 text-14 font-semibold text-danger">
                {r.fixedAmount ? "" : `${t("bills.about")} `}-{formatAmount(r.amount, r.account.currency)}
              </span>
            </li>
          ))}
          {soon.length > SHOWN && (
            <li className="px-4 py-2 text-13 text-ink-muted">
              <Link href="/bills" className="underline underline-offset-2">
                {t("bills.homeMore", { count: soon.length - SHOWN })}
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default ComingUp;
