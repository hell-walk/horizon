import type { Metadata } from "next";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.termsTitle"), description: t("legal.termsDescription") };
}

const UPDATED = Date.UTC(2026, 9, 9); // 9 October 2026

// Template text. Review it with a lawyer before publishing; edit freely.
export default async function TermsPage() {
  const t = await getT();
  const locale = await getLocale();
  const updated = new Date(UPDATED).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <h1>{t("legal.termsTitle")}</h1>
      <p className="eyebrow">{t("legal.lastUpdated", { date: updated })}</p>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      {/* The policy text itself is English only for now. */}
      <div lang="en">
        <p>By creating an account or using Horizon you agree to these terms.</p>

        <h2>The service</h2>
        <p>
          Horizon lets you view bank accounts you connect or import and, where supported, transfer money
          between them. Horizon is not a bank and does not hold your money. Transfers are executed by our
          payment partner on your instruction.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>You must provide accurate information and keep your login details private.</li>
          <li>You are responsible for activity carried out with your credentials.</li>
          <li>Only connect or import accounts that belong to you or that you are authorised to access.</li>
        </ul>

        <h2>Bank data</h2>
        <p>
          Balances and transactions are shown as reported by your bank or statement. They can lag behind
          your bank&apos;s own records. Always confirm with your bank before relying on a figure.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not attempt to access other users&apos; data or interfere with the service.</li>
          <li>Do not use Horizon for anything unlawful.</li>
        </ul>

        <h2>Liability</h2>
        <p>
          Horizon is provided as is. To the extent permitted by law, we are not liable for losses arising
          from reliance on the information shown, from delays at banks or payment partners, or from
          events outside our control.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. Continued use after an update means you accept the new terms. The
          date at the top shows the current version.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms go to <a href="mailto:support@horizon.app">support@horizon.app</a>.
        </p>
      </div>
    </>
  );
}
