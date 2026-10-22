import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { healthForOwner } from "@/lib/server/health";
import { cn } from "@/lib/utils";

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * The financial health score as a ring, in the overview beside the accounts.
 * The number for everyone; the five parts behind it live on the report page,
 * which the ring opens.
 */
const HealthRing = async ({ ownerId }: { ownerId: string }) => {
  const [health, t] = await Promise.all([healthForOwner(ownerId).catch(() => null), getT()]);
  const score = health?.score ?? null;
  const band = health?.band ?? null;
  const share = score === null ? 0 : score / 100;
  const tone = band === "good" ? "stroke-lime" : band === "poor" ? "stroke-danger" : "stroke-warn";

  return (
    <Link
      href="/report"
      className="group flex flex-col items-center gap-2 rounded-md p-2 transition-colors hover:bg-surface-low"
      aria-label={t("home.healthTitle")}
    >
      <span className="eyebrow">{t("home.healthTitle")}</span>
      <span className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-surface-container" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - share)}
            className={cn("ring-arrive", tone)}
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 flex-center flex-col">
          <span translate="no" className="font-display text-24 font-semibold leading-none text-ink">
            {score === null ? "–" : score}
          </span>
          <span className="eyebrow">/ 100</span>
        </span>
      </span>
      {band ? (
        <span className={cn("chip", band === "good" ? "chip-lime" : band === "poor" ? "border-danger text-danger" : "")}>{t(`home.healthBand_${band}`)}</span>
      ) : (
        <span className="text-12 text-ink-muted">{t("home.healthNotYetShort")}</span>
      )}
      <span className="eyebrow flex items-center gap-1 group-hover:text-ink">
        {t("home.tapToOpen")} <ArrowUpRight className="size-3" aria-hidden />
      </span>
    </Link>
  );
};

export default HealthRing;
