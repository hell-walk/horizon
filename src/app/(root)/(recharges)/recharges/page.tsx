import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, FileUp, Info, Smartphone, Wallet } from "lucide-react";

import { BarsLoader } from "@/components/ui/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { getLocale, getT } from "@/lib/i18n/server";
import { dateFormat } from "@/lib/finance/regularText";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { rechargesForOwner } from "@/lib/server/recharges";
import { formatAmount } from "@/lib/utils";

import RechargeList from "../components/rechargeList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("loans.rechargeMetaTitle"), description: t("loans.rechargeMetaDescription") };
}

const DAY = 86_400_000;

/**
 * Recharges: prepaid mobile and DTH plans, operator by operator. What each
 * person is on now, when it runs out, what that comes to a month, and every
 * recharge behind it. Free for everyone. The header and the loading shapes
 * come at once; the figures stream in when the statements are read.
 */
const Recharges = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  return (
    <section className="page">
      <HeaderBox eyebrow={t("loans.rechargeEyebrow")} title={t("loans.rechargePageTitle")} subtext={t("loans.rechargeIntro")} />
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
              <BarsLoader className="h-48" />
            </div>
          </>
        }
      >
        <RechargesContent ownerId={ownerIdOf(user)} />
      </Suspense>
    </section>
  );
};

async function RechargesContent({ ownerId }: { ownerId: string }) {
  const [picture, t, locale] = await Promise.all([rechargesForOwner(ownerId), getT(), getLocale()]);
  const money = (n: number) => formatAmount(Math.round(n), picture.currency);
  const day = dateFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  if (picture.items.length === 0) {
    return (
      <div className="panel panel-body flex max-w-2xl flex-col gap-3">
        <p className="text-14 text-ink">{t("loans.rechargeNone")}</p>
        <Link href="/upload-statement" className="btn-secondary w-fit">
          <FileUp className="size-4" aria-hidden /> {t("loans.emptyAction")}
        </Link>
      </div>
    );
  }

  // The soonest plan still running out ahead, counted from today.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = picture.items.filter((r) => r.next && !r.lapsed).sort((a, b) => a.next!.localeCompare(b.next!))[0];
  const daysLeft = upcoming ? Math.round((Date.parse(upcoming.next!) - Date.parse(today)) / DAY) : 0;
  const first = picture.items.reduce((min, r) => (r.first < min ? r.first : min), picture.items[0].first);

  return (
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
  );
}

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

export default Recharges;
