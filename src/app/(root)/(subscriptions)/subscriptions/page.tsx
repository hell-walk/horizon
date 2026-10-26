import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BarsLoader } from "@/components/ui/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";

import RechargesSection from "../components/rechargesSection";
import SubscriptionsPanel from "../components/subscriptionsPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("loans.subsMetaTitle"), description: t("loans.subsMetaDescription") };
}

/**
 * Subscriptions and recharges: the two kinds of small payment that come back
 * on their own. Subscriptions first (the totals for everyone, the list for
 * subscribers), then prepaid mobile and DTH recharges, free for everyone.
 * The header comes at once; each section streams in as its statements are read.
 */
const Subscriptions = async () => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const ownerId = ownerIdOf(user);

  const placeholder = (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="panel p-4">
            <BarsLoader className="h-[76px]" />
          </div>
        ))}
      </div>
      <div className="panel">
        <BarsLoader className="h-40" />
      </div>
    </>
  );

  return (
    <section className="page">
      <HeaderBox eyebrow={t("loans.subsEyebrow")} title={t("loans.subsPageTitle")} subtext={t("loans.subsPageIntro")} />
      <Suspense fallback={placeholder}>
        <SubscriptionsPanel ownerId={ownerId} />
      </Suspense>
      <Suspense fallback={placeholder}>
        <RechargesSection ownerId={ownerId} />
      </Suspense>
    </section>
  );
};

export default Subscriptions;
