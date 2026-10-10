import type { Metadata } from "next";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.privacyTitle"), description: t("legal.privacyDescription") };
}

const UPDATED = Date.UTC(2026, 9, 9); // 9 October 2026

// Template text. Review it with a lawyer before publishing; edit freely.
export default async function PrivacyPage() {
  const t = await getT();
  const locale = await getLocale();
  const updated = new Date(UPDATED).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <h1>{t("legal.privacyTitle")}</h1>
      <p className="eyebrow">{t("legal.lastUpdated", { date: updated })}</p>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      {/* The policy text itself is English only for now. */}
      <div lang="en">
        <p>
          Horizon shows your bank accounts, balances and transactions in one place. This policy explains
          what we collect, why, and the choices you have.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Account details you give us at sign-up: name, email, address, date of birth and the identifiers required by our payment partner.</li>
          <li>Bank data you choose to connect through Plaid or an Account Aggregator, or import from a statement file: account names, masked numbers, balances and transactions.</li>
          <li>Technical data needed to run the service: session cookies, error reports and basic request logs.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To display your accounts and transactions and to let you send money between linked accounts.</li>
          <li>To keep the service secure, fix errors and prevent abuse.</li>
          <li>We do not sell your data and we do not use it for advertising.</li>
        </ul>

        <h2>Who we share it with</h2>
        <ul>
          <li>Appwrite, which stores your profile and bank records.</li>
          <li>Plaid and Dwolla, which connect to banks and move money on your instruction.</li>
          <li>Sentry, which receives error reports so we can fix problems.</li>
        </ul>
        <p>Each provider only receives what it needs for its part of the service.</p>

        <h2>Cookies</h2>
        <p>
          Horizon sets one strictly necessary cookie to keep you signed in. It is not used for tracking
          or advertising, and it is removed when you log out.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Disconnect a bank or delete imported statements at any time from My Banks.</li>
          <li>Ask us to delete your account and all data associated with it.</li>
          <li>Request a copy of the data we hold about you.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this policy go to <a href="mailto:support@horizon.app">support@horizon.app</a>.
        </p>
      </div>
    </>
  );
}
