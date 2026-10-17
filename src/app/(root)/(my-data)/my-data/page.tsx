import type { Metadata } from "next";
import { redirect } from "next/navigation";

import LandingHero from "@/components/landingHero";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, loadSession, ownerIdOf } from "@/lib/server/auth";
import { getBanks } from "@/lib/server/banks";
import { emailConfigured, loadNotify, pushConfigured } from "@/lib/server/notify";

import DeleteAccount from "../components/deleteAccount";
import DownloadData from "../components/downloadData";
import Reminders from "../components/reminders";
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
      {/* The landing page's top beside the page, level with the heading and pinned there while the rest scrolls. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,560px)] xl:items-start">
        <div className="flex min-w-0 max-w-3xl flex-col gap-6">
          <HeaderBox eyebrow={t("data.eyebrow")} title={t("data.title")} subtext={t("data.intro")} />
          <Reminders
            vapidKey={pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY! : ""}
            emailReady={emailConfigured()}
            emailOn={(await loadNotify(ownerIdOf(user)).catch(() => null))?.email ?? false}
            address={user.email}
          />
          <DownloadData />
          <RemoveBanks banks={banks} />
          <DeleteAccount hasPassword={(await loadSession())?.hasPassword ?? true} />
        </div>
        <LandingHero className="hidden xl:sticky xl:top-5 xl:block" />
      </div>
    </section>
  );
};

export default MyData;
