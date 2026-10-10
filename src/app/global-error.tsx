"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_TAGS, type Locale } from "@/lib/i18n/config";
import { makeTranslator } from "@/lib/i18n/translate";

const subscribe = () => () => {};

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
  const t = makeTranslator(locale);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={LOCALE_TAGS[locale]}>
      <body>
        <main style={page}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{t("common.errorTitle")}</h1>
          <p style={{ fontSize: 14, maxWidth: 420, margin: 0 }}>{t("common.errorBody")}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ fontSize: 14, padding: "8px 16px", cursor: "pointer" }}>
              {t("common.reloadPage")}
            </button>
            <Link href="/" style={{ fontSize: 14, padding: "8px 0" }}>
              {t("common.backHome")}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
