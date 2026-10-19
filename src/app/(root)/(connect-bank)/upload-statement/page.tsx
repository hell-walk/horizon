import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import ImportStatement from "@/components/importStatement";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { maskKnown, maskLabel } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("connect.uploadMetaTitle"), description: t("connect.metaDescription") };
}

/**
 * Just the upload: "Upload a statement" lands here, on the form, with nothing
 * to choose first. ?account= (the "+" on a card) fills in the bank and the last
 * digits, so an older statement joins that account instead of making a new one.
 */
const UploadStatement = async ({ searchParams }: { searchParams: Promise<{ account?: string | string[] }> }) => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const { account: wanted } = await searchParams;
  const accounts: Account[] = (await getAccounts({ userId: ownerIdOf(loggedIn) }))?.data ?? [];
  // Only the user's own statement accounts: a bank link's account cannot take a file.
  const account = typeof wanted === "string" ? accounts.find((a) => a.appwriteItemId === wanted && a.provider === "manual") : undefined;
  const t = await getT();

  return (
    <section className="page">
      <Link href={account ? "/my-banks" : "/"} className="btn-ghost w-fit">
        <ArrowLeft className="size-4" aria-hidden /> {account ? t("connect.uploadBackBanks") : t("connect.uploadBack")}
      </Link>
      <HeaderBox
        eyebrow={t("connect.uploadEyebrow")}
        title={account ? t("connect.uploadForTitle", { name: account.name }) : t("connect.uploadTitle")}
        subtext={account ? t("connect.uploadForSubtext", { name: account.name, mask: maskLabel(account.mask) }) : t("connect.uploadSubtext")}
      />

      <section className="panel">
        <div className="panel-body">
          <ImportStatement account={account ? { name: account.name, mask: maskKnown(account.mask) ? account.mask : "" } : undefined} />
        </div>
      </section>

      <p className="text-13 text-ink-muted">
        <Link href="/connect-bank" className="underline underline-offset-4 hover:text-ink">
          {t("connect.uploadOtherWays")}
        </Link>
      </p>
    </section>
  );
};

export default UploadStatement;
