import { Gem, HeartPulse, Lock } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import type { Health, HealthPart } from "@/lib/health";
import { healthForOwner } from "@/lib/server/health";
import { currentPlan } from "@/lib/server/plan";
import { cn } from "@/lib/utils";

/**
 * Home's financial health: the score, its band and the part with most to gain
 * for everyone; the five parts, with the figure behind each, for subscribers.
 */
const HealthPanel = async ({ ownerId }: { ownerId: string }) => {
  const [health, plan, t] = await Promise.all([healthForOwner(ownerId).catch(() => null), currentPlan(), getT()]);
  if (!health) return null;
  const subscribed = plan?.kind === "subscribed";

  return (
    <section className="panel" aria-labelledby="health-title">
      <header className="panel-head">
        <h2 id="health-title" className="eyebrow flex items-center gap-2">
          <HeartPulse className="size-3.5" aria-hidden /> {t("home.healthTitle")}
        </h2>
        {health.months > 0 && <span className="eyebrow">{t("home.healthWindow", { count: health.months })}</span>}
      </header>
      <div className="panel-body flex flex-col gap-4">
        {health.score === null ? (
          <p className="text-14 text-ink-muted">{t("home.healthNotYet")}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <p translate="no" className="font-display text-40 font-semibold leading-none text-ink">
              {health.score}
              <span className="text-16 text-ink-muted"> / 100</span>
            </p>
            <span className={cn("chip", health.band === "good" ? "chip-lime" : health.band === "poor" ? "border-danger text-danger" : "")}>
              {t(`home.healthBand_${health.band}`)}
            </span>
            {health.opportunity && (
              <p className="w-full text-14 text-ink-muted">{t("home.healthOpportunity", { part: t(`home.healthPart_${health.opportunity}`) })}</p>
            )}
          </div>
        )}

        {subscribed ? (
          <ul className="flex flex-col divide-y divide-line">
            {health.parts.map((part) => (
              <Part key={part.key} part={part} months={health.months} t={t} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-low p-4">
            <p className="flex items-start gap-2 text-13 text-ink-muted">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t("home.healthLockedText")}</span>
            </p>
            <Link href="/plans" className="btn-primary w-fit">
              <Gem className="size-4" aria-hidden /> {t("home.checksSeePlans")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

/** One part: its name, points, and the figure behind it in words. */
const Part = ({ part, months, t }: { part: HealthPart; months: number; t: Translate }) => {
  const percent = (v: number) => `${Math.round(v * 100)}%`;
  let why: string;
  if (part.points === null || part.value === null) why = t("home.healthUnknown");
  else if (part.key === "savings") why = t("home.healthSavings", { percent: percent(part.value) });
  else if (part.key === "emi") why = t("home.healthEmi", { percent: percent(part.value) });
  else if (part.key === "commitments") why = t("home.healthCommitments", { percent: percent(part.value) });
  else if (part.key === "charges") why = t("home.healthCharges", { count: part.value, months });
  else why = t("home.healthCushion", { months: (Math.round(part.value * 10) / 10).toString() });
  const share = part.points === null ? 0 : part.points / part.max;
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-14 font-semibold text-ink">{t(`home.healthPart_${part.key}`)}</span>
        <span translate="no" className="font-mono text-12 text-ink-muted">
          {part.points === null ? "–" : t("home.healthPoints", { points: part.points, max: part.max })}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
        <div
          className={cn("h-full rounded-full", share >= 0.7 ? "bg-lime" : share >= 0.4 ? "bg-chart-4" : "bg-danger")}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
      <p className="text-13 text-ink-muted">{why}</p>
    </li>
  );
};

export default HealthPanel;
