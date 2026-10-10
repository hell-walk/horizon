import type { Metadata } from "next";
import Link from "next/link";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { TRIAL_DAYS } from "@/lib/plans";
import { CONTACT_EMAIL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.refundsTitle"), description: t("legal.refundsDescription") };
}

const UPDATED = Date.UTC(2026, 9, 11); // 11 October 2026

// Refund and cancellation policy (Razorpay asks for one before activating
// payments). It describes what the code does: cancelling stops renewal at the
// end of the paid period; deleting the account cancels at once. Have a lawyer
// review it before taking live payments.
export default async function RefundsPage() {
  const t = await getT();
  const locale = await getLocale();
  const updated = new Date(UPDATED).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <h1>{t("legal.refundsTitle")}</h1>
      <p className="eyebrow">{t("legal.lastUpdated", { date: updated })}</p>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      <div lang="en">
        <h2>Try before you pay</h2>
        <p>
          Every account starts with a {TRIAL_DAYS}-day free trial, with no payment details asked. Nothing is ever
          charged unless you choose a plan on the Plans page.
        </p>

        <h2>Cancelling</h2>
        <ul>
          <li>Plans renew automatically (every month or every year) until you cancel.</li>
          <li>Cancel any time on the Plans page, in two clicks. No email or call needed.</li>
          <li>After cancelling you keep everything until the end of the period you already paid for. Nothing more is charged.</li>
          <li>Deleting your account cancels your plan at once, before anything is deleted.</li>
        </ul>

        <h2>Refunds</h2>
        <p>Because you can try Horizon free first, payments are not normally refunded. We do refund in full when:</p>
        <ul>
          <li>you were charged after you had cancelled, or charged twice for the same period;</li>
          <li>you were charged but could not use Horizon for most of that period because of a fault on our side;</li>
          <li>you write to us within 7 days of your first payment for a plan and have not used it since (for example, you subscribed by mistake).</li>
        </ul>
        <p>
          To ask for a refund, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you
          sign in with, with the date and amount of the charge. We answer within 2 working days. Approved refunds
          go back to the card, UPI account or bank account you paid with, normally within 5 to 7 working days
          (Razorpay and your bank set the exact time).
        </p>

        <h2>Prices and taxes</h2>
        <p>
          Prices are shown on the <Link href="/pricing">pricing page</Link> in Indian rupees. If GST applies, it is
          shown on the payment page before you pay. A price change never affects a period you have already paid for;
          we tell you by email before it applies to your next renewal.
        </p>
      </div>
    </>
  );
}
