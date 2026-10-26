import { AlertTriangle, BellRing, CalendarClock, Info, Landmark } from "lucide-react";
import Link from "next/link";

import type { HeadsUp } from "@/lib/finance/headsUp";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/finance/regularText";
import ReminderLanguage from "@/components/preferences/reminderLanguage";
import { headsUpFor } from "@/lib/server/headsUp";
import { loadNotify } from "@/lib/server/notify";
import { cn, formatAmount, maskLabel } from "@/lib/utils";

const SHOWN = 5;

/**
 * Home's "Be prepared": EMIs about to be taken (and whether the account can
 * cover them), bank charges about to come back, a recent minimum-balance
 * penalty. Nothing at all when there is nothing to be ready for.
 */
const BeReady = async ({ ownerId }: { ownerId: string }) => {
  const [{ items, staleSince }, reminders] = await Promise.all([headsUpFor(ownerId), loadNotify(ownerId).catch(() => null)]);
  if (items.length === 0) return null;
  const remindersOn = Boolean(reminders && (reminders.email || reminders.push.length > 0));

  const t = await getT();
  const locale = await getLocale();
  const day = dateFormat(locale, { day: "numeric", month: "short" });

  return (
    <section className="panel" aria-labelledby="be-ready">
      <header className="panel-head">
        <h2 id="be-ready" className="eyebrow flex items-center gap-2">
          <BellRing className="size-3.5" aria-hidden /> {t("ready.title")}
        </h2>
        <Link href="/my-data#reminders" className="btn-ghost btn-sm">
          {t("ready.remindMe")}
        </Link>
      </header>
      <ul className="divide-y divide-line">
        {items.slice(0, SHOWN).map((item, i) => (
          <Item key={i} item={item} t={t} day={day} />
        ))}
      </ul>
      {items.length > SHOWN && (
        <p className="px-4 pb-3 text-13 text-ink-muted">
          <Link href="/bills" className="underline underline-offset-2">
            {t("ready.more", { count: items.length - SHOWN })}
          </Link>
        </p>
      )}
      {remindersOn && <ReminderLanguage current={reminders!.locale} className="border-t border-line px-4 py-3" />}
      {staleSince && (
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-12 text-ink-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("ready.stale", { date: day(staleSince) })}
        </p>
      )}
    </section>
  );
};

const Item = ({ item, t, day }: { item: HeadsUp; t: Translate; day: (d: string) => string }) => {
  const money = (n: number) => formatAmount(n, item.account.currency);
  const where = `${item.account.name} ${maskLabel(item.account.mask)}`;
  const when = "days" in item ? (item.days === 0 ? t("ready.today") : t("ready.inDays", { count: item.days, date: day(item.date) })) : "";

  if (item.kind === "shortfall") {
    return (
      <Row icon={AlertTriangle} tone="danger" title={t("ready.shortfallTitle", { account: where })}>
        {t("ready.shortfallBody", { balance: money(item.balance), date: day(item.asOf), needed: money(item.needed) })}
      </Row>
    );
  }
  if (item.kind === "emi") {
    return (
      <Row
        icon={CalendarClock}
        tone="ink"
        title={t("ready.emiTitle", { lender: item.lender, amount: `${item.fixed ? "" : `${t("bills.about")} `}${money(item.amount)}` })}
      >
        {when} · <span translate="no">{where}</span>. {t("ready.emiBody")}
      </Row>
    );
  }
  if (item.kind === "charge") {
    return (
      <Row icon={Landmark} tone="ink" title={t(`ready.charge_${item.charge}`, { amount: money(item.amount) })}>
        {when} · <span translate="no">{where}</span>. {t(`ready.chargeBody_${item.charge}`)}
      </Row>
    );
  }
  return (
    <Row icon={AlertTriangle} tone="warn" title={t("ready.minBalanceTitle", { amount: money(item.amount), date: day(item.date) })}>
      <span translate="no">{where}</span>. {t("ready.minBalanceBody")}{" "}
      <Link href="/charges" className="underline underline-offset-2">
        {t("ready.seeCharges")}
      </Link>
    </Row>
  );
};

const Row = ({ icon: Icon, tone, title, children }: { icon: typeof Info; tone: "danger" | "warn" | "ink"; title: string; children: React.ReactNode }) => (
  <li className={cn("flex gap-3 px-4 py-3", tone === "danger" && "bg-danger-soft/40")}>
    <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn-ink" : "text-ink-muted")} aria-hidden />
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-14 font-semibold text-ink">{title}</p>
      <p className="text-13 text-ink-muted">{children}</p>
    </div>
  </li>
);

export default BeReady;
