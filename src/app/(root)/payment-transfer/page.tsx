import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import PaymentTransferForm from "@/components/PaymentTransferForm";
import HeaderBox from "@/components/ui/headerBox";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { activeAccountId } from "@/lib/server/selectedAccount";

export const metadata: Metadata = {
  title: "Transfer funds",
  description: "Send money between linked bank accounts.",
};

const PaymentTransfer = async ({ searchParams }: SearchParamProps) => {
  const { id } = await searchParams;
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  const accountsData: Account[] = accounts?.data ?? [];

  return (
    <section className="page">
      <HeaderBox
        eyebrow="Transfers // dispatch"
        title="Transfer funds"
        subtext="Send money from one of your linked accounts to another Horizon user. Four steps, one confirmation."
      />

      {accountsData.length === 0 ? (
        <div className="panel flex-center flex-col gap-3 p-10 text-center">
          <p className="text-16 font-semibold text-ink">Link an account first</p>
          <p className="max-w-md text-14 text-ink-muted">Transfers need a source account. Connect a bank to get started.</p>
          <Link href="/connect-bank" className="btn-primary mt-2">
            Connect a bank
          </Link>
        </div>
      ) : (
        <PaymentTransferForm accounts={accountsData} initialId={await activeAccountId(accountsData, id)} />
      )}
    </section>
  );
};

export default PaymentTransfer;
