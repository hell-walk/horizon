import type { Metadata } from "next";
import { redirect } from "next/navigation";

import LandingStory from "@/components/landingStory";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser } from "@/lib/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.about"), description: t("landing.metaDescription") };
}

/** The landing page's story for someone already signed in: what Horizon does and the pages, with no sign-up buttons. */
const AboutHorizon = async () => {
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const t = await getT();

  return (
    <section className="page">
      <HeaderBox eyebrow={t("nav.about")} title={t("landing.tagline")} subtext={t("landing.heroBody")} />
      {/* shrink-0: inside the page's flex column a clipped box would otherwise shrink to the viewport and nothing would scroll. */}
      <div className="-mx-4 shrink-0 overflow-hidden rounded-lg border border-line bg-card sm:-mx-6 lg:-mx-8">
        <LandingStory linked motion={false} looks={false} />
        <section className="border-t border-line px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <p className="eyebrow">{t("landing.closingEyebrow")}</p>
            <h2 className="font-display text-32 font-bold uppercase leading-none tracking-tighter sm:text-[48px]">{t("landing.closingTitle")}</h2>
            <p className="max-w-md text-16 text-ink-muted">{t("landing.closingBody")}</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default AboutHorizon;
