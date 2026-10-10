import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import PaymentTransferForm from "../components/PaymentTransferForm";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { activeAccountId } from "@/lib/server/selectedAccount";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("transfer.metaTitle"), description: t("transfer.metaDescription") };
}

const PaymentTransfer = async ({ searchParams }: SearchParamProps) => {
  const { id } = await searchParams;
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  const accountsData: Account[] = accounts?.data ?? [];
  const t = await getT();

  return (
    <section className="page">
      <HeaderBox
        eyebrow={t("transfer.eyebrow")}
        title={t("transfer.title")}
        subtext={t("transfer.subtext")}
      />

      {accountsData.length === 0 ? (
        <div className="panel flex-center flex-col gap-3 p-10 text-center">
          <p className="text-16 font-semibold text-ink">{t("transfer.noAccountTitle")}</p>
          <p className="max-w-md text-14 text-ink-muted">{t("transfer.noAccountBody")}</p>
          <Link href="/connect-bank" className="btn-primary mt-2">
            {t("transfer.connectBank")}
          </Link>
        </div>
      ) : (
        <PaymentTransferForm accounts={accountsData} initialId={await activeAccountId(accountsData, id)} />
      )}
    </section>
  );
};

export default PaymentTransfer;
