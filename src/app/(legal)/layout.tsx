import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import SiteFooter from "@/components/siteFooter";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col bg-white font-inter">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icons/logo.svg" width={28} height={28} alt="Horizon logo" />
          <span className="sidebar-logo !block text-[22px]">Horizon</span>
        </Link>
        <Link href="/sign-in" className="view-all-btn">
          Sign in
        </Link>
      </header>
      <article className="prose-sm mx-auto w-full max-w-3xl flex-1 px-6 py-10 text-gray-700 [&_h1]:text-30 [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h2]:text-18 [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:text-gray-900 [&_p]:mt-3 [&_li]:mt-1 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}
