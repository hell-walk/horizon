import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getT } from "@/lib/i18n/server";
import { publicPage } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return publicPage(t("legal.supportTitle"), t("legal.supportDescription"), "/support");
}

// The questions people ask, answered in one place, and how to reach a person.
export default async function SupportPage() {
  const t = await getT();
  const locale = await getLocale();

  return (
    <>
      <h1>{t("legal.supportTitle")}</h1>
      {locale !== "en" && <p className="rounded-md border border-line bg-card px-3 py-2 text-ink">{t("legal.englishOnlyNote")}</p>}

      <div lang="en">
        <p>
          Most questions are answered below. For anything else, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and you will hear back within
          two working days. Signed in, you can also use the <Link href="/feedback">feedback page</Link>.
        </p>

        <h2>Statements</h2>
        <h3>Which statements can I upload?</h3>
        <p>
          PDF and Excel exports from Indian banks, including SBI, PNB, HDFC, ICICI, Axis and Kotak. If a bank is not read correctly, send a sample with the
          numbers blacked out and it will be added.
        </p>
        <h3>My statement has a password</h3>
        <p>Enter it on the upload page. It is used once, to open the file, and never stored.</p>
        <h3>Some entries are missing or doubled</h3>
        <p>
          Horizon checks each upload against what it already has, so overlapping statements do not double up. If entries are missing, the statement probably has
          a gap: the My banks page shows which dates are covered.
        </p>

        <h2>Sorting and numbers</h2>
        <h3>A payment is in the wrong category, or has the wrong name</h3>
        <p>Open it from the account history and change it. Horizon remembers your choice for that payee, so the next one lands right.</p>
        <h3>Why does Horizon ask &ldquo;Is this right?&rdquo;</h3>
        <p>
          Where a statement leaves something unclear, such as money moving between your own accounts, it asks you once. Three answers are free; subscribers can
          answer as many as they like.
        </p>
        <h3>Where does the health score come from?</h3>
        <p>
          Five parts, each from your own entries: savings rate, EMI burden, regular commitments, bank charges and cushion. The report page shows the figure
          behind each part.
        </p>

        <h2>Plans and payments</h2>
        <h3>What is free?</h3>
        <p>
          A free week with everything but the subscriber analysis, then viewing your accounts, downloading your data, removing a bank and deleting your account
          stay free for good. See <Link href="/pricing">pricing</Link>.
        </p>
        <h3>How do I cancel or get a refund?</h3>
        <p>
          Cancel any time from the Plans page; access runs to the end of the period you paid for. Refunds follow the <Link href="/refunds">refund policy</Link>.
        </p>

        <h2>Your data</h2>
        <h3>Can I take my data out or delete it?</h3>
        <p>Yes, both from the Privacy and your data page: a copy of everything as a file, or the whole account removed, including every statement entry.</p>
      </div>
    </>
  );
}
