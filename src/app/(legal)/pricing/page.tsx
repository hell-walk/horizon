import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { PRICES, TRIAL_CHANGES_PER_DAY, TRIAL_DAYS } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.pricingTitle"), description: t("legal.pricingDescription") };
}

// The public price list (Razorpay asks for one before activating payments).
// Every number comes from src/lib/plans.ts, the same place the app enforces them.
export default async function PricingPage() {
  const t = await getT();
  const locale = await getLocale();
  const money = (amount: number) => new Intl.NumberFormat(LOCALE_TAGS[locale], { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  const plans = [
    { name: "Free trial", price: money(0), per: `for ${TRIAL_DAYS} days`, points: [`Everything in Horizon for ${TRIAL_DAYS} days`, `${TRIAL_CHANGES_PER_DAY} changes a day (imports, corrections, goals, bank links)`, "No card or UPI needed to start"] },
    { name: "Monthly", price: money(PRICES.monthly.amount), per: "per month", points: ["Unlimited imports, corrections and goals", "Renews every month until you cancel", "Cancel any time from the Plans page"] },
    { name: "Yearly", price: money(PRICES.yearly.amount), per: "per year", points: ["Everything in Monthly", "About two months free compared with paying monthly", "Renews every year until you cancel"] },
  ];

  return (
    <>
      <h1>{t("legal.pricingTitle")}</h1>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}
      <div lang="en">
        <p>
          Every new account gets {TRIAL_DAYS} days free, no payment details needed. After that, Horizon stays open for
          viewing; to keep importing statements, correcting entries and planning goals, choose a plan. Prices are in
          Indian rupees and are charged through Razorpay.
        </p>

        <div className="my-8 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <section key={plan.name} className="panel">
              <div className="panel-body flex h-full flex-col gap-3">
                <h2 className="eyebrow !mt-0">{plan.name}</h2>
                <p className="!mt-0 flex items-baseline gap-1">
                  <span className="font-display text-32 font-semibold text-ink">{plan.price}</span>
                  <span className="text-13 text-ink-muted">{plan.per}</span>
                </p>
                <ul className="!mt-0 flex !list-none flex-col gap-2 !pl-0 text-14 text-ink">
                  {plan.points.map((point) => (
                    <li key={point} className="!mt-0 flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <h2>Always free</h2>
        <p>
          Seeing your accounts, downloading a copy of your data, removing a bank and deleting your account never cost
          anything and are never locked, whatever your plan.
        </p>

        <h2>Cancelling and refunds</h2>
        <p>
          You can cancel any time; you keep everything until the end of the period you paid for. See the{" "}
          <Link href="/refunds">refund and cancellation policy</Link> for when we refund a payment.
        </p>

        <p>
          <Link href="/sign-up" className="btn-primary inline-flex">
            Start your free trial
          </Link>
        </p>
      </div>
    </>
  );
}
