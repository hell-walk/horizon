import type { ReactNode } from "react";
import Link from "next/link";

import LanguageSwitch from "@/components/languageSwitch";
import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import ThemeSwitch from "@/components/themeSwitch";
import { getT } from "@/lib/i18n/server";

// The public face of the site (the landing page): light or dark like the app,
// a slim header with the two ways in, and the usual footer.
export default async function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getT();
  return (
    <div className="flex min-h-screen w-full flex-col bg-surface text-ink">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface-low/90 px-4 backdrop-blur sm:px-6 lg:px-8">
        {/* Phones: the mark alone, and no theme switch; the row must fit 320px. */}
        <Logo href="/" className="max-sm:hidden" />
        <Logo href="/" compact className="sm:hidden" />
        <nav aria-label={t("nav.mainMenu")} className="hidden items-center gap-5 font-mono text-[12px] uppercase tracking-wider text-ink-muted md:flex">
          <a href="#features" className="hover:text-ink">
            {t("landing.navFeatures")}
          </a>
          <Link href="/pricing" className="hover:text-ink">
            {t("landing.navPricing")}
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitch />
          <ThemeSwitch compact className="max-sm:hidden" />
          <Link href="/sign-in" className="btn-ghost btn-sm max-sm:hidden">
            {t("landing.signIn")}
          </Link>
          <Link href="/sign-up" className="btn-accent btn-sm">
            {t("landing.getStarted")}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
