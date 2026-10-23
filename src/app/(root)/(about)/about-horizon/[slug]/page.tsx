import { ArrowUpRight, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Shot from "@/components/shot";
import HeaderBox from "@/components/ui/headerBox";
import { aboutFeature, SHOT_ALT } from "@/lib/aboutFeatures";
import { getT } from "@/lib/i18n/server";
import { getLoggedInUser } from "@/lib/server/auth";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const feature = aboutFeature(slug);
  const t = await getT();
  return feature ? { title: t(`landing.cap${feature.n}Title`), description: t(`landing.cap${feature.n}Body`) } : { title: t("nav.about") };
}

/** One capability from the About page: what it does, a closer look where there is one, its screens, and the way into the page itself. */
const AboutFeaturePage = async ({ params }: Props) => {
  const { slug } = await params;
  const feature = aboutFeature(slug);
  if (!feature) notFound();
  const user = await getLoggedInUser();
  if (!user) redirect("/sign-in");
  const t = await getT();
  const open = (
    <Link href={feature.route} className="btn-accent">
      {t("landing.openInApp")} <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  );

  return (
    <section className="page">
      <HeaderBox
        eyebrow={`${t("nav.about")} · ${String(feature.n).padStart(2, "0")}`}
        title={t(`landing.cap${feature.n}Title`)}
        subtext={t(`landing.cap${feature.n}Body`)}
        actions={
          <>
            <Link href="/about-horizon" className="btn-ghost">
              <ChevronLeft className="size-4" aria-hidden /> {t("nav.about")}
            </Link>
            {open}
          </>
        }
      />

      {feature.looks.length > 0 && (
        <div className="grid shrink-0 gap-4 lg:grid-cols-2">
          {feature.looks.map((k) => (
            <article key={k} className="panel panel-body flex flex-col gap-2">
              <p className="eyebrow">{t(`landing.f${k}Label`)}</p>
              <h2 className="font-display text-24 font-semibold uppercase leading-tight tracking-tight">{t(`landing.f${k}Title`)}</h2>
              <p className="max-w-2xl text-15 text-ink-muted">{t(`landing.f${k}Body`)}</p>
            </article>
          ))}
        </div>
      )}

      {/* The screens themselves (shrink-0: a direct child of the page's flex column). */}
      <div className="flex shrink-0 flex-col gap-6">
        {feature.shots.map((shot) => (
          <Shot
            key={shot}
            name={shot}
            alt={t(SHOT_ALT[shot])}
            sizes="(min-width: 1280px) 60vw, 100vw"
            className={shot === "home-phone" ? "mx-auto w-full max-w-[300px] rounded-[28px]" : undefined}
          />
        ))}
      </div>

      <div className="shrink-0">{open}</div>
    </section>
  );
};

export default AboutFeaturePage;
