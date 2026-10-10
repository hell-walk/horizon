import type { ReactNode } from "react";

import LanguageSwitch from "@/components/languageSwitch";
import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getT();
  // [label, value, value is data (currency codes are never translated)]
  const facts: [string, string, boolean][] = [
    [t("auth.factConnect"), t("auth.factConnectValue"), false],
    [t("auth.factCurrencies"), "USD · INR", true],
    [t("auth.factData"), t("auth.factDataValue"), false],
  ];

  return (
    // Always dark, whatever the app theme: the `dark` class re-scopes the tokens.
    <main className="dark flex min-h-screen w-full flex-col bg-surface text-ink [color-scheme:dark]">
      {/* Wraps onto two rows on narrow phones (320px) instead of overflowing. */}
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-surface-low px-4 py-2 sm:px-6">
        <Logo href="/sign-in" />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span className="chip">
            <span className="dot bg-lime" />
            {t("auth.testMode")}
          </span>
          <LanguageSwitch />
        </div>
      </header>

      <div id="main" tabIndex={-1} className="grid flex-1 outline-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-black p-10 text-white lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)]">
          <span className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-white/10" />
          <span className="pointer-events-none absolute -right-36 -top-36 size-96 rounded-full border border-white/10" />

          <div className="flex flex-col gap-6">
            <p className="eyebrow text-lime">{t("auth.brandEyebrow")}</p>
            <h2 className="font-display text-40 font-semibold leading-[1.05] tracking-tight">
              {t("auth.brandTitleLine1")}
              <br />
              {t("auth.brandTitleLine2")}
            </h2>
            <p className="max-w-sm text-14 text-white/70">{t("auth.brandBody")}</p>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-white/15 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-14 font-bold uppercase tracking-tight">Horizon</span>
              <span className="chip border-lime bg-lime text-lime-foreground">{t("auth.cardExample")}</span>
            </div>
            <p className="amount text-20 tracking-[0.2em]" translate="no">
              <span className="opacity-50">•••• •••• ••••</span> 4091
            </p>
            <div className="flex items-end justify-between">
              <span className="flex flex-col">
                <span className="eyebrow text-white/60">{t("auth.cardHolder")}</span>
                <span className="font-mono text-12 uppercase">{t("auth.cardYourName")}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="eyebrow text-white/60">{t("auth.cardBalance")}</span>
                <span className="amount text-14 font-semibold" translate="no">
                  ₹1,24,560.50
                </span>
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            {facts.map(([label, value, isData]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="eyebrow text-white/60">{label}</dt>
                <dd className="font-mono text-12" translate={isData ? "no" : undefined}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* Form */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center">{children}</div>
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
