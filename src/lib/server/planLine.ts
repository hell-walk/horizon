import "server-only";

import { LOCALE_TAGS } from "../i18n/config";
import { getLocale, getT } from "../i18n/server";
import { daysLeft, type PlanState } from "../content/plans";

/** "Free trial: 5 days left", "Subscribed · renews 13 November 2026 · 23 days left", "Free week ended": under the name, everywhere. */
export async function planLine(plan: PlanState): Promise<string> {
  const t = await getT();
  if (plan.kind === "trial") return t("plan.lineTrial", { count: daysLeft(plan.endsAt) });
  if (plan.kind === "ended") return t("plan.lineEnded");
  const date = new Date(plan.until).toLocaleDateString(LOCALE_TAGS[await getLocale()], { day: "numeric", month: "long", year: "numeric" });
  return `${t(plan.renews ? "plan.lineRenews" : "plan.lineUntil", { date })} · ${t("plan.daysLeft", { count: daysLeft(plan.until) })}`;
}
