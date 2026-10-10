import type { ReactNode } from "react";
import Link from "next/link";

import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import ThemeSwitch from "@/components/themeSwitch";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-screen w-full flex-col outline-none">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface-low px-4 sm:px-6">
        <Logo className="max-[400px]:hidden" />
        <Logo compact className="hidden max-[400px]:flex" />
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <Link href="/sign-in" className="btn-primary btn-sm">
            Sign in
          </Link>
        </div>
      </header>
      <article className="prose-legal mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</article>
      <SiteFooter />
    </main>
  );
}
