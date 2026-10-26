import { Play } from "lucide-react";
import Link from "next/link";

import TourStart from "@/components/tour/tourStart";
import { ABOUT_FEATURES } from "@/lib/content/aboutFeatures";
import { isTourId } from "@/lib/content/tour";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

import Shot from "./shot";

/**
 * What Horizon does, in nine, and the pages themselves with their screens: the
 * middle of the landing page, also shown to a signed-in person on the About
 * page (without the sign-up buttons).
 */
/** The pages each capability lives on (Home's slideshow opens them). */
export const CAPABILITY_ROUTES = ABOUT_FEATURES.map((f) => f.route);

/**
 * `linked`: each capability card opens its own About page, with the closer
 * look and the screens (signed in). `looks`: the closer looks with their
 * screens (off on the About page, where each box's own page has them). `motion`: the
 * scroll-driven rise, which needs the page itself to be the scroller (the
 * landing page); inside the app the page scrolls in its own box, so it is off.
 */
export default async function LandingStory({ linked = false, motion = true, looks = true }: { linked?: boolean; motion?: boolean; looks?: boolean } = {}) {
  const t = await getT();
  const rise = motion ? "landing-rise" : "";
  const capabilities = [
    ["01", t("landing.cap1Title"), t("landing.cap1Body")],
    ["02", t("landing.cap2Title"), t("landing.cap2Body")],
    ["03", t("landing.cap3Title"), t("landing.cap3Body")],
    ["04", t("landing.cap4Title"), t("landing.cap4Body")],
    ["05", t("landing.cap5Title"), t("landing.cap5Body")],
    ["06", t("landing.cap6Title"), t("landing.cap6Body")],
    ["07", t("landing.cap7Title"), t("landing.cap7Body")],
    ["08", t("landing.cap8Title"), t("landing.cap8Body")],
    ["09", t("landing.cap9Title"), t("landing.cap9Body")],
  ] as const;

  const features = [
    { shot: "home", label: t("landing.f1Label"), title: t("landing.f1Title"), body: t("landing.f1Body"), alt: t("landing.shotHome") },
    { shot: "connect", label: t("landing.f2Label"), title: t("landing.f2Title"), body: t("landing.f2Body"), alt: t("landing.shotConnect") },
    { shot: "bills", label: t("landing.f3Label"), title: t("landing.f3Title"), body: t("landing.f3Body"), alt: t("landing.shotBills") },
    { shot: "goals", label: t("landing.f4Label"), title: t("landing.f4Title"), body: t("landing.f4Body"), alt: t("landing.shotGoals") },
    { shot: "charges", label: t("landing.f5Label"), title: t("landing.f5Title"), body: t("landing.f5Body"), alt: t("landing.shotCharges") },
    { shot: "loans", label: t("landing.f6Label"), title: t("landing.f6Title"), body: t("landing.f6Body"), alt: t("landing.shotLoans") },
    { shot: "calendar", label: t("landing.f7Label"), title: t("landing.f7Title"), body: t("landing.f7Body"), alt: t("landing.shotCalendar") },
    { shot: "report", label: t("landing.f8Label"), title: t("landing.f8Title"), body: t("landing.f8Body"), alt: t("landing.shotReport") },
  ] as const;

  return (
    <>
      {/* What it does, in six. */}
      <section className={cn("border-t border-line bg-surface-low px-4 sm:px-6 lg:px-8", linked ? "py-6 sm:py-14" : "py-14")}>
        <div className="mx-auto max-w-6xl">
          <p className={cn("eyebrow", linked ? "mb-3 sm:mb-6" : "mb-6")}>{t("landing.overviewEyebrow")}</p>
          <div className={cn("grid md:grid-cols-3", linked ? "gap-2 sm:gap-4" : "gap-4")}>
            {capabilities.map(([n, title, body], i) => {
              const inner = (
                <div className={cn("panel-body flex flex-col", linked ? "gap-1.5 sm:gap-3" : "gap-3")}>
                  <span className="font-mono text-[12px] tracking-wider text-lime-foreground">
                    <span className="chip chip-lime">{n}</span>
                  </span>
                  <h2 className="font-display text-20 font-semibold uppercase tracking-tight">{title}</h2>
                  <p className={cn("text-14 text-ink-muted", linked && "line-clamp-2 sm:line-clamp-none")}>{body}</p>
                </div>
              );
              const slug = ABOUT_FEATURES[i].slug;
              return linked ? (
                <article key={n} className={cn("panel flex flex-col", rise)}>
                  <Link href={`/about-horizon/${slug}`} className="flex-1 rounded-lg transition-colors hover:bg-surface-low">
                    {inner}
                  </Link>
                  {isTourId(slug) && (
                    <div className="border-t border-line px-3 py-1.5">
                      <TourStart id={slug} className="btn-ghost btn-sm">
                        <Play className="size-3.5" aria-hidden /> {t("tour.demo")}
                      </TourStart>
                    </div>
                  )}
                </article>
              ) : (
                <article key={n} className={cn("panel", rise)}>
                  {inner}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* The pages themselves. */}
      {looks && (
        <section id="features" className="scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-16">
            <p className="eyebrow">{t("landing.featuresEyebrow")}</p>
            {features.map((f, i) => (
              <article key={f.shot} className={cn("grid items-center gap-8 md:grid-cols-2 md:gap-12", rise)}>
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <Shot name={f.shot} alt={f.alt} sizes="(min-width: 768px) 50vw, 100vw" />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-[12px] uppercase tracking-wider text-ink-faint">{f.label}</p>
                  <h2 className="font-display text-28 font-semibold uppercase leading-tight tracking-tight sm:text-32">{f.title}</h2>
                  <p className="max-w-md text-16 text-ink-muted">{f.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
