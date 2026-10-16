import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import { I18nProvider } from "@/components/i18nProvider";
import SentryLater from "@/components/sentryLater";
import { ThemeProvider } from "@/components/themeProvider";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { messagesFor } from "@/lib/i18n/translate";

import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Self-hosted like the others; only downloaded by browsers when a page shows Devanagari text.
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-devanagari", display: "swap", preload: false });

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Horizon",
    template: "%s | Horizon",
  },
  description: "All your bank accounts, balances and transactions in one place.",
  applicationName: "Horizon",
  openGraph: {
    type: "website",
    siteName: "Horizon",
    title: "Horizon",
    description: "All your bank accounts, balances and transactions in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Horizon",
    description: "All your bank accounts, balances and transactions in one place.",
  },
  // Private app: individual pages are noindex, the public entry pages opt back in.
  robots: { index: false, follow: false },
  // Search engines' ownership checks, when the "HTML tag" method is used (the
  // codes are public by nature: they sit in every page's head). Google Search
  // Console and Bing Webmaster Tools each show theirs on their setup page.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getT();
  return (
    // next-themes sets the class on <html> before paint; the warning it would
    // otherwise trigger is expected.
    <html lang={LOCALE_TAGS[locale]} suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} ${mono.variable} ${devanagari.variable}`}>
        <a href="#main" className="skip-link">
          {t("common.skipToContent")}
        </a>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
        <SentryLater />
      </body>
    </html>
  );
}
