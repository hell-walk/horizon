import type { Metadata } from "next";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { daysLeft, PRICES, TRIAL_CHANGES_PER_DAY, TRIAL_DAYS } from "@/lib/plans";
import { currentPlan } from "@/lib/server/plan";
import { isRazorpayConfigured, isTestMode } from "@/lib/server/razorpay";

import PlansPanel from "../components/plansPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("plan.metaTitle") };
}

// Where you stand (trial, ended, subscribed) and the two plans. What the page
// says is what the server enforces (lib/server/plan.ts), from lib/plans.ts.
const Plans = async () => {
  const t = await getT();
  const plan = await currentPlan();
  if (!plan) redirect("/sign-in");
  const tag = LOCALE_TAGS[await getLocale()];
  const date = (ms: number) => new Date(ms).toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" });
  const money = (amount: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  return (
    <section className="page">
      <HeaderBox eyebrow={t("plan.eyebrow")} title={t("plan.title")} subtext={t("plan.intro", { days: TRIAL_DAYS, limit: TRIAL_CHANGES_PER_DAY })} />
      <PlansPanel
        plan={plan}
        daysLeft={plan.kind === "trial" ? daysLeft(plan.endsAt) : 0}
        untilText={plan.kind === "subscribed" ? date(plan.until) : ""}
        prices={{ monthly: money(PRICES.monthly.amount), yearly: money(PRICES.yearly.amount) }}
        ready={{ monthly: isRazorpayConfigured("monthly"), yearly: isRazorpayConfigured("yearly") }}
        testMode={isTestMode()}
      />
    </section>
  );
};

export default Plans;
