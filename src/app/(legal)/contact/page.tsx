import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { BUSINESS_ADDRESS, BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.contactTitle"), description: t("legal.contactDescription") };
}

// How to reach the people behind Horizon (Razorpay checks this page). The
// details come from environment variables, see src/lib/site.ts.
export default async function ContactPage() {
  const t = await getT();
  const locale = await getLocale();

  return (
    <>
      <h1>{t("legal.contactTitle")}</h1>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      <div lang="en">
        <p>Questions about your account, a payment, a refund or your data: we answer within 2 working days.</p>
        <ul>
          <li>
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </li>
          {CONTACT_PHONE && (
            <li>
              Phone: <a href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}>{CONTACT_PHONE}</a>
            </li>
          )}
          <li>Run by: {BUSINESS_NAME}</li>
          {BUSINESS_ADDRESS && <li>Address: {BUSINESS_ADDRESS}</li>}
        </ul>

        <h2>Something missing or not working?</h2>
        <p>
          If you have an account, the <Link href="/feedback">feedback form</Link> (under More) reaches us directly
          and tells us which page you were on.
        </p>

        <h2>Your data</h2>
        <p>
          You can download or delete everything yourself on <Link href="/my-data">Privacy and your data</Link>. The{" "}
          <Link href="/privacy">privacy policy</Link> explains what we keep, and the{" "}
          <Link href="/refunds">refund and cancellation policy</Link> covers payments.
        </p>
      </div>
    </>
  );
}
