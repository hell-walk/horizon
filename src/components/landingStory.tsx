import { getT } from "@/lib/i18n/server";

import Shot from "./shot";

/**
 * What Horizon does, in six, and the pages themselves with their screens: the
 * middle of the landing page, also shown to a signed-in person on the About
 * page (without the sign-up buttons).
 */
export default async function LandingStory() {
  const t = await getT();
  const capabilities = [
    ["01", t("landing.cap1Title"), t("landing.cap1Body")],
    ["02", t("landing.cap2Title"), t("landing.cap2Body")],
    ["03", t("landing.cap3Title"), t("landing.cap3Body")],
    ["04", t("landing.cap4Title"), t("landing.cap4Body")],
    ["05", t("landing.cap5Title"), t("landing.cap5Body")],
    ["06", t("landing.cap6Title"), t("landing.cap6Body")],
  ] as const;

  const features = [
    { shot: "home", label: t("landing.f1Label"), title: t("landing.f1Title"), body: t("landing.f1Body"), alt: t("landing.shotHome") },
    { shot: "connect", label: t("landing.f2Label"), title: t("landing.f2Title"), body: t("landing.f2Body"), alt: t("landing.shotConnect") },
    { shot: "bills", label: t("landing.f3Label"), title: t("landing.f3Title"), body: t("landing.f3Body"), alt: t("landing.shotBills") },
    { shot: "goals", label: t("landing.f4Label"), title: t("landing.f4Title"), body: t("landing.f4Body"), alt: t("landing.shotGoals") },
  ] as const;

  return (
    <>
      {/* What it does, in six. */}
      <section className="border-t border-line bg-surface-low px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-6">{t("landing.overviewEyebrow")}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map(([n, title, body]) => (
              <article key={n} className="panel landing-rise">
                <div className="panel-body flex flex-col gap-3">
                  <span className="font-mono text-[12px] tracking-wider text-lime-foreground">
                    <span className="chip chip-lime">{n}</span>
                  </span>
                  <h2 className="font-display text-20 font-semibold uppercase tracking-tight">{title}</h2>
                  <p className="text-14 text-ink-muted">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The pages themselves. */}
      <section id="features" className="scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-16">
          <p className="eyebrow">{t("landing.featuresEyebrow")}</p>
          {features.map((f, i) => (
            <article key={f.shot} className="landing-rise grid items-center gap-8 md:grid-cols-2 md:gap-12">
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
    </>
  );
}
