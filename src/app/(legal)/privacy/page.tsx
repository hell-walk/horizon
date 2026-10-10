import type { Metadata } from "next";
import Link from "next/link";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("legal.privacyTitle"), description: t("legal.privacyDescription") };
}

const UPDATED = Date.UTC(2026, 9, 10); // 10 October 2026

// This text describes what the code really does (checked 10 October 2026).
// When the code changes what it collects, where data goes, or which cookies
// it sets, change this page in the same commit. Have a lawyer review it, and
// replace the contact address with a real, monitored mailbox, before launch.
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
          Horizon shows your bank accounts, balances and transactions in one place. This policy says what
          we keep about you, why, where it is kept, who else sees it, and how you can see it or delete it.
          We have tried to write it in plain words.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>We keep only what the app needs to show you your money.</li>
          <li>We do not sell your data, show you adverts, or use it to build a profile of you.</li>
          <li>We do not record your screen or track what you click.</li>
          <li>
            You can download everything we keep, remove a bank, or delete your whole account yourself, at any
            time, on <Link href="/my-data">Privacy and your data</Link>.
          </li>
        </ul>

        <h2>What we keep</h2>
        <ul>
          <li>
            <strong>Your account:</strong> name, email address, the country you live in, postal address and a
            password. Your password is held by our database provider in hashed form; we cannot read it.
          </li>
          <li>
            <strong>Date of birth and US Social Security number:</strong> asked only if you live in the United
            States, because our US payment partner needs them to open your payment account. They are sent to
            Dwolla and Horizon does not store them. Nobody outside the US is asked for them.
          </li>
          <li>
            <strong>Your banks:</strong> bank name, account name, the last four digits of the account number,
            balances and transactions, from a bank you connect or a statement you upload.
          </li>
          <li>
            <strong>Statement files:</strong> we read the file on our server, keep the transactions you confirm,
            and throw the file away. If the file is locked, the password is used once to open it and is not
            kept. If you tell us which column is which, we remember that layout (not the contents) so the next
            statement from the same bank is quicker.
          </li>
          <li>
            <strong>Your changes and goals:</strong> names and categories you give to entries, so they show the
            way you want, and the savings goals you set. The bank&apos;s own record is kept as it was.
          </li>
          <li>
            <strong>Transfers:</strong> the amount, date, note, and who sent and received it.
          </li>
          <li>
            <strong>Bank access keys:</strong> the keys that let us fetch your bank data are stored encrypted,
            and are never shown to you, to other users, or in error reports.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address is held in our server&apos;s memory for a short time
            to stop people guessing passwords. It is not written to our database.
          </li>
        </ul>

        <h2>Why we use it</h2>
        <ul>
          <li>To show you your accounts and transactions, and to send money when you ask us to. (We need it to provide the service you signed up for.)</li>
          <li>To keep accounts safe, stop abuse and fix errors. (Our legitimate interest in running a secure service.)</li>
          <li>To meet legal duties, such as the checks our payment partner must do. (Legal obligation.)</li>
        </ul>

        <h2>Who else sees it</h2>
        <p>These companies process data for us. Each gets only what it needs for its part.</p>
        <ul>
          <li><strong>Appwrite</strong> stores your account and bank records, in data centres in Frankfurt, Germany.</li>
          <li><strong>Plaid</strong> connects to US banks when you choose to link one.</li>
          <li><strong>Setu</strong> connects to Indian banks through the Account Aggregator system, only after you give consent on Setu&apos;s own page.</li>
          <li><strong>Dwolla</strong> opens payment accounts and moves money, for users with a US address.</li>
          <li>
            <strong>Sentry</strong> receives error reports, stored in Germany. Before a report leaves our
            servers we remove cookies, request contents, email addresses, account numbers and keys. Sentry is
            set not to keep your name or IP address, and it does not record your screen.
          </li>
          <li>
            <strong>Frankfurter</strong> supplies the European Central Bank&apos;s exchange rates when you hold more than one
            currency. It is sent only currency codes (like INR and USD), never anything about you.
          </li>
          <li><strong>Our hosting provider</strong> runs the website and sees the requests your browser makes, as any website host does.</li>
        </ul>
        <p>
          If we add a translation service for more languages, it will only receive the app&apos;s own words
          (buttons and help text), never your data.
        </p>
        <p>
          Some of these providers are outside your country. Where the law requires it, we rely on their
          standard contractual protections for moving data between countries.
        </p>

        <h2>Cookies and storage in your browser</h2>
        <p>We use no tracking or advertising cookies, so we do not ask you to accept any. The ones we set are:</p>
        <ul>
          <li><code>banking-session</code>: keeps you signed in. Removed when you log out; lasts at most 30 days.</li>
          <li><code>horizon-lang</code>: remembers the language you picked. Lasts a year.</li>
          <li><code>horizon-account</code>: remembers which of your banks you last looked at. Lasts a year.</li>
          <li><code>setu-consent</code>: holds an Indian bank consent while you approve it on Setu. Lasts 30 minutes.</li>
          <li>Your browser&apos;s own storage remembers light or dark mode. It never leaves your device.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Until you delete it. Removing a bank deletes its transactions and disconnects it straight away.</li>
          <li>
            Deleting your account removes your profile, banks, transactions and sign-in straight away, and
            closes your Dwolla payment account. Your database provider may keep encrypted backups for a short
            time before they expire.
          </li>
          <li>
            Transfers also belong to the other person, so we keep their record but replace your name and
            details with &quot;deleted user&quot;.
          </li>
          <li>Error reports are deleted by Sentry after its standard retention period (90 days at most).</li>
        </ul>

        <h2>Your rights</h2>
        <p>Depending on where you live, the law gives you rights over your data. Wherever you live, you can:</p>
        <ul>
          <li><strong>See it:</strong> download everything we keep, as a file, on <Link href="/my-data">Privacy and your data</Link>.</li>
          <li><strong>Correct it:</strong> write to us and we will fix it.</li>
          <li><strong>Delete it:</strong> remove a bank, or your whole account, on the same page.</li>
          <li><strong>Take back consent:</strong> for an Indian bank, through Setu or your Account Aggregator app; or by removing the bank here.</li>
          <li><strong>Complain:</strong> to us first, and if you are not happy, to your data protection authority.</li>
        </ul>
        <p>We answer requests within 30 days, and we never charge for them.</p>

        <h2>Keeping it safe</h2>
        <p>
          Connections are encrypted, bank keys are encrypted at rest, only our server can read the database,
          and we test the app against common attacks. No system is perfect: if a breach puts your data at
          risk, we will tell you and the authorities as quickly as the law requires.
        </p>

        <h2>Who can use Horizon</h2>
        <p>Horizon is for people aged 18 or over. We do not knowingly keep data about children.</p>

        <h2>Changes</h2>
        <p>If we change this policy in a way that matters, we will tell you in the app before it takes effect.</p>

        <h2>Contact</h2>
        <p>
          Questions, requests and complaints about your data go to{" "}
          <a href="mailto:support@horizon.app">support@horizon.app</a>.
        </p>
      </div>
    </>
  );
}
