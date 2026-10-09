import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/components/themeProvider";

import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the class on <html> before paint; the warning it would
    // otherwise trigger is expected.
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} ${mono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
