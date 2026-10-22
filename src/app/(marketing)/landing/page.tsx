import type { Metadata } from "next";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { TRIAL_DAYS } from "@/lib/plans";
import { jsonLd, publicPage } from "@/lib/seo";
import { currentPricing } from "@/lib/server/pricing";

import LandingStory from "@/components/landingStory";
import Shot from "@/components/shot";

// What a visitor sees at the site's root before signing in (the proxy
// rewrites "/" here when there is no session; signed-in people get Home).
// Real screenshots, honest claims, and motion that costs nothing: the drift
// and rise effects are scroll-driven CSS, off under reduced motion.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return publicPage(t("landing.metaTitle"), t("landing.metaDescription"), "/");
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function Landing() {
  const t = await getT();
  const tag = LOCALE_TAGS[await getLocale()];
  const pricing = await currentPricing();
  const money = (amount: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  const structured = jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Horizon", url: siteUrl, logo: `${siteUrl}/icon.svg` },
      { "@type": "WebSite", name: "Horizon", url: siteUrl },
      {
        "@type": "SoftwareApplication",
        name: "Horizon",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: siteUrl,
        description: t("landing.metaDescription"),
        // What search engines can list as the app's features (English, like the rest of the markup).
        featureList: [
          "Every Indian bank account in one place, from statement uploads (PDF, Excel, CSV)",
          "Spending sorted automatically: UPI, cards, EMIs, pay later",
          "Hidden bank charges found, with a request to ask the bank for a reversal",
          "Every EMI and loan by lender: banks, NBFCs, loan apps, pay later",
          "Each kind of spending in detail, with charts",
          "Bills and subscriptions found, with what is due next",
          "Savings goals and a cash-flow forecast",
          "Eleven Indian languages",
        ],
        offers: [
          { "@type": "Offer", name: "Monthly", price: String(pricing.monthly.amount), priceCurrency: "INR", category: "subscription" },
          { "@type": "Offer", name: "Yearly", price: String(pricing.yearly.amount), priceCurrency: "INR", category: "subscription" },
        ],
      },
    ],
  });

  const ctas = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link href="/sign-up" className="btn-accent">
        {t("landing.createAccount")} <ArrowRight className="size-4" aria-hidden />
      </Link>
      <Link href="/sign-in" className="btn-secondary">
        {t("landing.signIn")}
      </Link>
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />

      {/* Hero: the name, the line, the two ways in; the app itself drifting beneath. */}
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <p className="chip h-auto max-w-full whitespace-normal py-1 text-center">
            <span className="dot bg-lime shrink-0" />
            {t("landing.heroEyebrow")}
          </p>
          <h1 className="font-display text-[clamp(56px,15vw,176px)] font-bold uppercase leading-[0.9] tracking-tighter text-ink">Horizon</h1>
          <p className="font-display text-24 font-semibold tracking-tight sm:text-32">{t("landing.tagline")}</p>
          <p className="max-w-xl text-16 text-ink-muted">{t("landing.heroBody")}</p>
          {ctas}
          <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-ink-faint">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            {t("landing.trust")}
          </p>
        </div>

        {/* Three screens on wide screens, the phone on narrow ones. */}
        <div className="relative mx-auto mt-12 hidden max-w-6xl items-end gap-4 md:grid md:grid-cols-[1fr_1.5fr_1fr]">
          <Shot name="history" alt={t("landing.shotHistory")} sizes="(min-width: 1280px) 30vw, 28vw" tilt={-3} drift="slow" className="translate-y-6" />
          <Shot name="home" alt={t("landing.shotHome")} priority sizes="(min-width: 1280px) 45vw, 42vw" drift="normal" />
          <Shot name="goals" alt={t("landing.shotGoals")} sizes="(min-width: 1280px) 30vw, 28vw" tilt={3} drift="fast" className="translate-y-6" />
        </div>
        <div className="mx-auto mt-10 max-w-[300px] md:hidden">
          <Shot name="home-phone" alt={t("landing.shotPhone")} priority sizes="300px" className="rounded-[28px]" />
        </div>
      </section>

      {/* What it does, in six, and the pages themselves (shared with the signed-in About page). */}
      <LandingStory />

      {/* The price, said once, plainly. */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="landing-rise mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-lg bg-primary px-6 py-14 text-center text-primary-foreground">
          <p className="eyebrow text-lime">{t("landing.priceEyebrow")}</p>
          <h2 className="max-w-3xl font-display text-28 font-semibold uppercase leading-tight tracking-tight sm:text-40">
            {t("landing.priceTitle", { days: TRIAL_DAYS, monthly: money(pricing.monthly.amount), yearly: money(pricing.yearly.amount) })}
          </h2>
          <p className="max-w-xl text-14 text-primary-foreground/70">{t("landing.priceBody")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-accent">
              {t("landing.startFree")} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/pricing" className="btn-ghost text-primary-foreground hover:text-primary-foreground">
              {t("landing.seePricing")}
            </Link>
          </div>
        </div>
      </section>

      {/* The close. */}
      <section className="border-t border-line px-4 py-20 sm:px-6 lg:px-8">
        <div className="landing-rise mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <p className="eyebrow">{t("landing.closingEyebrow")}</p>
          <h2 className="font-display text-40 font-bold uppercase leading-none tracking-tighter sm:text-[64px]">{t("landing.closingTitle")}</h2>
          <p className="max-w-md text-16 text-ink-muted">{t("landing.closingBody")}</p>
          {ctas}
        </div>
      </section>
    </>
  );
}
