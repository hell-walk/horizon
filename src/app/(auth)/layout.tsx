import type { ReactNode } from "react";

import Logo from "@/components/logo";
import SiteFooter from "@/components/siteFooter";
import ThemeSwitch from "@/components/themeSwitch";

const FACTS: [string, string][] = [
  ["Providers", "Plaid · Setu AA · Statement"],
  ["Currencies", "USD · INR"],
  ["Data", "Read only"],
];

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface-low px-4 sm:px-6">
        <Logo href="/sign-in" />
        <div className="flex items-center gap-3">
          <span className="chip max-sm:hidden">
            <span className="dot bg-lime" />
            Sandbox
          </span>
          <ThemeSwitch />
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)]">
          <span className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-primary-foreground/10" />
          <span className="pointer-events-none absolute -right-36 -top-36 size-96 rounded-full border border-primary-foreground/10" />

          <div className="flex flex-col gap-6">
            <p className="eyebrow text-lime">{"Horizon // 01"}</p>
            <h2 className="font-display text-40 font-semibold leading-[1.05] tracking-tight">
              Every account.
              <br />
              One ledger.
            </h2>
            <p className="max-w-sm text-14 text-primary-foreground/70">
              Balances and transactions from US and Indian banks, side by side, in the currency they live in.
            </p>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-14 font-bold uppercase tracking-tight">Horizon</span>
              <span className="chip border-lime bg-lime text-lime-foreground">Demo</span>
            </div>
            <p className="amount text-20 tracking-[0.2em]">
              <span className="opacity-50">•••• •••• ••••</span> 4091
            </p>
            <div className="flex items-end justify-between">
              <span className="flex flex-col">
                <span className="eyebrow text-primary-foreground/60">Holder</span>
                <span className="font-mono text-12 uppercase">Your name</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="eyebrow text-primary-foreground/60">Balance</span>
                <span className="amount text-14 font-semibold">₹1,24,560.50</span>
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-6">
            {FACTS.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="eyebrow text-primary-foreground/60">{label}</dt>
                <dd className="font-mono text-12">{value}</dd>
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
