import type { ReactNode } from "react";
import Link from "next/link";

import BrandPanel from "@/components/brandPanel";
import LanguageSwitch from "@/components/languageSwitch";
import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import { getT } from "@/lib/i18n/server";
import { isTestMode } from "@/lib/server/razorpay";

export default async function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getT();

  return (
    // Always dark, whatever the app theme: the `dark` class re-scopes the tokens.
    <main className="dark flex min-h-screen w-full flex-col bg-surface text-ink [color-scheme:dark]">
      {/* Wraps onto two rows on narrow phones (320px) instead of overflowing. */}
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-surface-low px-4 py-2 sm:px-6">
        <Logo href="/sign-in" />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* Only while payments run on Razorpay's test keys. */}
          {isTestMode() && (
            <span className="chip">
              <span className="dot bg-lime" />
              {t("auth.testMode")}
            </span>
          )}
          <Link href="/pricing" className="font-mono text-[12px] uppercase tracking-wider text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            {t("common.footerPricing")}
          </Link>
          <LanguageSwitch />
        </div>
      </header>

      <div id="main" tabIndex={-1} className="grid flex-1 outline-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <BrandPanel className="hidden lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)]" />

        {/* Form */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center">{children}</div>
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
