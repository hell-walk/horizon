import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

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
    <html lang="en">
      <body className={`${inter.variable} ${ibmPlexSerif.variable}`}>
        {children}
      </body>
    </html>
  );
}
