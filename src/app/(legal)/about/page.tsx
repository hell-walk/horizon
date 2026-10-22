import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { publicPage } from "@/lib/seo";
import { BUSINESS_NAME, CONTACT_EMAIL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return publicPage(t("legal.aboutTitle"), t("legal.aboutDescription"), "/about");
}

// What Horizon is and how it thinks. English only, like the other public pages.
export default async function AboutPage() {
  const t = await getT();
  const locale = await getLocale();

  return (
    <>
      <h1>{t("legal.aboutTitle")}</h1>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      <div lang="en">
        <p>
          Horizon reads the bank statements you already have and tells you what they say: where the money goes, which charges the bank took, every EMI by
          lender, what is due in the coming weeks, and how healthy the whole picture is. It is built for India: UPI, SBI and PNB exports, pay-later apps, and
          eleven Indian languages.
        </p>

        <h2>How it works</h2>
        <ul>
          <li>
            <strong>Statement first.</strong> You upload the PDF or Excel your bank gives you. Horizon never asks for your net-banking login, and it does not
            pull data from your bank.
          </li>
          <li>
            <strong>Numbers you can check.</strong> Every figure is worked out from entries you can see, with the rule written beside it. There is no model
            guessing in the background.
          </li>
          <li>
            <strong>It asks when unsure.</strong> Where a statement is ambiguous, a transfer between your own accounts for instance, Horizon asks you once and
            remembers the answer.
          </li>
          <li>
            <strong>Your data stays yours.</strong> You can download everything, remove a bank, or delete your account at any time, whether or not you pay.
          </li>
        </ul>

        <h2>What it costs</h2>
        <p>
          Every new account gets a free week with no card. After that, seeing your accounts stays free; the analysis that takes work, such as the EMI breakdown
          and each kind of spending in detail, is for subscribers. See <Link href="/pricing">pricing</Link>.
        </p>

        <h2>Who makes it</h2>
        <p>
          Horizon is made and run by {BUSINESS_NAME}. Questions, ideas, or something wrong: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or the{" "}
          <Link href="/support">support page</Link>.
        </p>
      </div>
    </>
  );
}
