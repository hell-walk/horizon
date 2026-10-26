import Link from "next/link";
import { CalendarClock, FileUp, Info, Smartphone, Wallet } from "lucide-react";

import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/finance/regularText";
import { rechargesForOwner } from "@/lib/server/recharges";
import { formatAmount } from "@/lib/utils";

import RechargeList from "./rechargeList";

const DAY = 86_400_000;

/**
 * Recharges, under the subscriptions: prepaid mobile and DTH plans, operator
 * by operator. What the person is on now, when it runs out, what that comes
 * to a month, and every recharge behind it. Free for everyone.
 */
const RechargesSection = async ({ ownerId }: { ownerId: string }) => {
  const [picture, t, locale] = await Promise.all([rechargesForOwner(ownerId), getT(), getLocale()]);
  const money = (n: number) => formatAmount(Math.round(n), picture.currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  // The soonest plan still running out ahead, counted from today.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = picture.items.filter((r) => r.next && !r.lapsed).sort((a, b) => a.next!.localeCompare(b.next!))[0];
  const daysLeft = upcoming ? Math.round((Date.parse(upcoming.next!) - Date.parse(today)) / DAY) : 0;
  const first = picture.items.length ? picture.items.reduce((min, r) => (r.first < min ? r.first : min), picture.items[0].first) : "";

  return (
    <section id="recharges" className="flex scroll-mt-20 flex-col gap-3" aria-labelledby="recharges-title">
      <header className="flex flex-col gap-1">
        <h2 id="recharges-title" className="eyebrow flex items-center gap-2">
          <Smartphone className="size-3.5" aria-hidden /> {t("loans.rechargeTitle")}
        </h2>
        <p className="text-13 text-ink-muted">{t("loans.rechargeIntro")}</p>
      </header>

      {picture.items.length === 0 ? (
        <div className="panel panel-body flex max-w-2xl flex-col gap-3">
          <p className="text-14 text-ink-muted">{t("loans.rechargeNone")}</p>
          <Link href="/upload-statement" className="btn-secondary w-fit">
            <FileUp className="size-4" aria-hidden /> {t("loans.emptyAction")}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              icon={<Wallet className="size-3.5" aria-hidden />}
              label={t("loans.subsTileMonthly")}
              value={picture.monthly > 0 ? money(picture.monthly) : "—"}
              note={t(picture.monthly > 0 ? "loans.rechargeTileMonthlyNote" : "loans.rechargeTileMonthlyNone")}
            />
            <Tile
              icon={<CalendarClock className="size-3.5" aria-hidden />}
              label={t("loans.rechargeTileNext")}
              value={upcoming ? day(upcoming.next!) : "—"}
              note={
                !upcoming
                  ? t("loans.rechargeTileNextNone")
                  : daysLeft <= 0
                    ? t("loans.rechargeTileNextDue", { operator: upcoming.operator })
                    : t("loans.rechargeTileNextNote", { operator: upcoming.operator, count: daysLeft })
              }
            />
            <Tile
              icon={<Smartphone className="size-3.5" aria-hidden />}
              label={t("loans.subsTilePaid")}
              value={money(picture.total)}
              note={`${t("loans.rechargeTileCount", { count: picture.count })} · ${t("loans.rechargeTileSince", { date: day(first) })}`}
            />
          </div>

          <RechargeList items={picture.items} currency={picture.currency} />

          {picture.leftOut.length > 0 && (
            <p className="panel panel-body flex items-start gap-2 text-13 text-ink-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {t("loans.rechargeLeftOut", {
                  count: picture.leftOut.length,
                  list: picture.leftOut
                    .slice(0, 3)
                    .map((b) => `${b.operator} ${formatAmount(b.amount, picture.currency)}, ${day(b.date)}`)
                    .join("; "),
                })}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
};

const Tile = ({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) => (
  <article className="panel flex flex-col gap-1 p-4">
    <p className="eyebrow flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p translate="no" className="amount text-20 font-semibold text-ink">
      {value}
    </p>
    <p className="text-12 text-ink-muted">{note}</p>
  </article>
);

export default RechargesSection;
