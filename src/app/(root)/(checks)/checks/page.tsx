import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import ChecksPanel from "@/components/checksPanel";
import { BarsLoader } from "@/components/loaders";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("home.checksPageTitle"), description: t("home.checksPageIntro") };
}

/** "Is this right?": the questions the statements leave open, one at a time. Reached from the bar under the top bar. */
const ChecksPage = async () => {
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const t = await getT();

  return (
    <section className="page">
      <HeaderBox eyebrow={t("home.checksTitle")} title={t("home.checksPageTitle")} subtext={t("home.checksPageIntro")} />
      <Suspense
        fallback={
          <div className="panel">
            <BarsLoader className="h-40" />
          </div>
        }
      >
        <ChecksPanel ownerId={ownerIdOf(user)} person={{ firstName: user.firstName, lastName: user.lastName }} showEmpty />
      </Suspense>
    </section>
  );
};

export default ChecksPage;
