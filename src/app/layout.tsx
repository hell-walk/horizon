import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  JetBrains_Mono,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Oriya,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from "next/font/google";

import { I18nProvider } from "@/components/providers/i18nProvider";
import SentryLater from "@/components/providers/sentryLater";
import { ThemeProvider } from "@/components/providers/themeProvider";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getHomeLocale, getLocale, getT } from "@/lib/i18n/server";
import { messagesFor } from "@/lib/i18n/translate";

import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--ff-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--ff-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--ff-mono", display: "swap" });
// Self-hosted like the others; only downloaded by browsers when a page shows Devanagari text.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-devanagari",
  display: "swap",
  preload: false,
});
// The other Indian scripts: the same arrangement, one font each.
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--ff-bengali", display: "swap", preload: false });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], weight: ["400", "500", "600", "700"], variable: "--ff-tamil", display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "500", "600", "700"], variable: "--ff-telugu", display: "swap", preload: false });
const gujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-gujarati",
  display: "swap",
  preload: false,
});
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["400", "500", "600", "700"], variable: "--ff-kannada", display: "swap", preload: false });
const malayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-malayalam",
  display: "swap",
  preload: false,
});
const gurmukhi = Noto_Sans_Gurmukhi({
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-gurmukhi",
  display: "swap",
  preload: false,
});
const oriya = Noto_Sans_Oriya({ subsets: ["oriya"], weight: ["400", "500", "600", "700"], variable: "--ff-oriya", display: "swap", preload: false });

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Horizon",
    template: "%s | Horizon",
  },
  description: "All your Indian bank accounts in one place: spending sorted, hidden bank charges found, every EMI by lender, bills and goals.",
  applicationName: "Horizon",
  // Added to an iPhone's home screen, Horizon opens full screen like an app.
  appleWebApp: { capable: true, title: "Horizon", statusBarStyle: "black" },
  openGraph: {
    type: "website",
    siteName: "Horizon",
    title: "Horizon",
    description: "All your Indian bank accounts in one place: spending sorted, hidden bank charges found, every EMI by lender, bills and goals.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Horizon",
    description: "All your Indian bank accounts in one place: spending sorted, hidden bank charges found, every EMI by lender, bills and goals.",
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
    <html
      lang={LOCALE_TAGS[locale]}
      className={[sans, display, mono, devanagari, bengali, tamil, telugu, gujarati, kannada, malayalam, gurmukhi, oriya].map((f) => f.variable).join(" ")}
      suppressHydrationWarning
    >
      <body>
        <a href="#main" className="skip-link">
          {t("common.skipToContent")}
        </a>
        <I18nProvider locale={locale} messages={await messagesFor(locale)} homeLocale={await getHomeLocale()}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
        <SentryLater />
      </body>
    </html>
  );
}
