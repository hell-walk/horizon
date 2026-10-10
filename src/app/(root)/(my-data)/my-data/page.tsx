import type { Metadata } from "next";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";
import { getBanks } from "@/lib/server/banks";

import DeleteAccount from "../components/deleteAccount";
import DownloadData from "../components/downloadData";
import RemoveBanks from "../components/removeBanks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("data.metaTitle") };
}

// Privacy and your data: a copy of everything, removing a bank, deleting the account.
const MyData = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");

  const banks = (await getBanks({ userId: ownerIdOf(user) })).map((b) => ({
    id: b.$id,
    name: b.institutionName ?? "Bank",
    mask: b.accountMask ?? "",
  }));

  return (
    <section className="page">
      <HeaderBox eyebrow={t("data.eyebrow")} title={t("data.title")} subtext={t("data.intro")} />
      <div className="flex max-w-3xl flex-col gap-6">
        <DownloadData />
        <RemoveBanks banks={banks} />
        <DeleteAccount />
      </div>
    </section>
  );
};

export default MyData;
