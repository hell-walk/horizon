import type { Metadata } from "next";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { daysLeft, PRICES, REFERRAL_FREE_DAYS, TRIAL_CHANGES_PER_DAY, TRIAL_DAYS } from "@/lib/plans";
import { loadSession } from "@/lib/server/auth";
import { myReferralCode } from "@/lib/server/codes";
import { currentPlan } from "@/lib/server/plan";
import { isRazorpayConfigured, isTestMode } from "@/lib/server/razorpay";

import CodesPanel from "../components/codesPanel";
import PlansPanel from "../components/plansPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("plan.metaTitle") };
}

// Where you stand (trial, ended, subscribed) and the two plans. What the page
// says is what the server enforces (lib/server/plan.ts), from lib/plans.ts.
const Plans = async () => {
  const t = await getT();
  const [plan, session] = await Promise.all([currentPlan(), loadSession()]);
  if (!plan || !session) redirect("/sign-in");
  const referralCode = await myReferralCode(session).catch(() => null);
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
      <div className="max-w-3xl">
        <CodesPanel referralCode={referralCode} referralDays={REFERRAL_FREE_DAYS} />
      </div>
    </section>
  );
};

export default Plans;
