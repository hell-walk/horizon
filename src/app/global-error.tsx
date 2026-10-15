"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_TAGS, type Locale } from "@/lib/i18n/config";

const subscribe = () => () => {};

// Its own few words, not the app's text tables: this page is loaded with every
// page (it must be ready should the root layout fail), and importing the
// tables here would ship every language to every visitor as script.
const TEXT: Record<Locale, { title: string; body: string; reload: string; home: string }> = {
  en: { title: "Something went wrong", body: "Please reload the page. If this keeps happening, try again in a few minutes.", reload: "Reload page", home: "Back to home" },
  hi: { title: "कुछ गड़बड़ हो गई", body: "कृपया पेज दोबारा लोड करें। अगर फिर भी ऐसा हो, तो कुछ मिनट बाद कोशिश करें।", reload: "पेज दोबारा लोड करें", home: "होम पर वापस जाएँ" },
};

// This page replaces the root layout, so the language provider is gone: read
// the chosen language from its cookie instead (English on the server).
const cookieLocale = (): Locale => {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

// Plain styles: globals.css is not loaded when the root layout itself failed.
const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 24,
  textAlign: "center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const locale = useSyncExternalStore(subscribe, cookieLocale, () => DEFAULT_LOCALE);
  const text = TEXT[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={LOCALE_TAGS[locale]}>
      <body>
        <main style={page}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{text.title}</h1>
          <p style={{ fontSize: 14, maxWidth: 420, margin: 0 }}>{text.body}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ fontSize: 14, padding: "8px 16px", cursor: "pointer" }}>
              {text.reload}
            </button>
            <Link href="/" style={{ fontSize: 14, padding: "8px 0" }}>
              {text.home}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
