import type { ReactNode } from "react";
import Link from "next/link";

import LanguageSwitch from "@/components/languageSwitch";
import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import ThemeSwitch from "@/components/themeSwitch";
import { getT } from "@/lib/i18n/server";

export default async function LegalLayout({ children }: { children: ReactNode }) {
  const t = await getT();

  return (
    <main id="main" tabIndex={-1} className="flex min-h-screen w-full flex-col outline-none">
      <header className="flex h-14 items-center justify-between gap-2 border-b border-line bg-surface-low px-4 sm:px-6">
        <Logo className="max-sm:hidden" />
        <Logo compact className="hidden max-sm:flex" />
        <div className="flex items-center gap-2">
          {/* Under 420px only the other language's button shows, so the bar fits a 320px phone. */}
          <LanguageSwitch className="max-[420px]:[&>[aria-pressed=true]]:hidden" />
          <ThemeSwitch />
          <Link href="/sign-in" className="btn-primary btn-sm whitespace-nowrap">
            {t("legal.signIn")}
          </Link>
        </div>
      </header>
      <article className="prose-legal mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</article>
      <SiteFooter />
    </main>
  );
}
