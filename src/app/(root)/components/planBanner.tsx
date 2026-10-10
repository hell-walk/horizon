import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { daysLeft, type PlanState } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** One line under the top bar during the trial and after it; nothing for subscribers. */
const PlanBanner = async ({ plan }: { plan: PlanState }) => {
  if (plan.kind === "subscribed") return null;
  const t = await getT();
  const ended = plan.kind === "ended";
  const text = ended
    ? t("plan.bannerEnded")
    : `${t("plan.bannerTrial", { count: daysLeft(plan.endsAt) })} · ${t("plan.bannerUsed", { used: plan.usedToday, limit: plan.limit })}`;
  return (
    <div role="status" className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-center text-13", ended ? "border-warn/40 bg-warn-soft text-warn-ink" : "border-line bg-surface-low text-ink-muted")}>
      <span>{text}</span>
      <Link href="/plans" className="font-semibold text-ink underline underline-offset-4">
        {t("plan.bannerSee")}
      </Link>
    </div>
  );
};

export default PlanBanner;
