"use client";

import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { logoutAccount } from "@/lib/actions/user.action";

import { useT } from "@/components/i18nProvider";
import LanguageSwitch from "@/components/languageSwitch";
import ThemeSwitch from "@/components/themeSwitch";

import BankSwitch, { type SwitchAccount } from "./bankSwitch";

// Avatar button in the top bar. Opens a panel with the account, the bank
// switcher (so any page can move to another account), the theme slider and
// language switch (useful on phones, where the bar has no room for them) and log out.
const UserMenu = ({ user, planLine, accounts, activeId }: { user: User; planLine: string; accounts: SwitchAccount[]; activeId?: string }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Picking an account closes the panel at once, inside the page sweep; the next opening animates again.
  const [instant, setInstant] = useState(false);
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || user.name?.[0] || "?";

  const [loggingOut, setLoggingOut] = useState(false);

  // A full page load afterwards, not a client-side move: it drops everything the
  // tab still holds about the signed-in person and runs on the current deployment.
  const handleLogOut = async () => {
    setLoggingOut(true);
    try {
      await logoutAccount();
      window.location.assign("/sign-in");
    } catch {
      // Usually a tab left open across a redeploy, whose action ids the new
      // deployment no longer knows: reload onto the new one and try again.
      window.location.reload();
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setInstant(false);
        setOpen(next);
      }}
    >
      <SheetTrigger
        aria-label={t("nav.accountMenu")}
        translate="no"
        className="flex-center size-9 rounded-full bg-primary font-display text-12 font-bold text-primary-foreground transition-opacity hover:opacity-85"
      >
        {initials}
      </SheetTrigger>
      <SheetContent side="right" instant={instant} className="flex w-[320px] flex-col gap-6 overflow-y-auto border-line bg-surface-low p-5 sm:max-w-sm">
        <SheetTitle className="sr-only">{t("nav.account")}</SheetTitle>

        <div className="flex items-center gap-3 pt-6">
          <div translate="no" className="flex-center size-12 shrink-0 rounded-sm bg-primary font-display text-16 font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col">
            <p translate="no" className="truncate text-16 font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p translate="no" className="truncate text-12 text-ink-muted">
              {user.email}
            </p>
            {planLine && (
              <Link href="/plans" onClick={() => setOpen(false)} className="mt-0.5 text-12 text-ink-muted underline-offset-4 hover:underline">
                {planLine}
              </Link>
            )}
            <span className="chip-lime mt-1 w-fit">
              <ShieldCheck className="size-3" /> {t("common.verified")}
            </span>
          </div>
        </div>

        <BankSwitch
          accounts={accounts}
          activeId={activeId}
          onPicked={() => {
            setInstant(true);
            setOpen(false);
          }}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-md border border-line bg-card px-3 py-2.5">
            <span className="eyebrow">{t("common.appearance")}</span>
            <ThemeSwitch />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-3 py-2">
            <span className="eyebrow">{t("common.language")}</span>
            <LanguageSwitch />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Link href="/connect-bank" onClick={() => setOpen(false)} className="btn-secondary justify-start">
            {t("nav.connect")}
          </Link>
          <Link href="/my-data" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            {t("data.menuLink")}
          </Link>
          <Link href="/privacy" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            {t("nav.privacyPolicy")}
          </Link>
          <Link href="/terms" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            {t("nav.terms")}
          </Link>
          <Link href="/support" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            {t("common.footerSupport")}
          </Link>
        </div>

        <button type="button" onClick={handleLogOut} disabled={loggingOut} className="btn-primary mt-auto w-full">
          {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} {t("nav.logOut")}
        </button>
      </SheetContent>
    </Sheet>
  );
};

export default UserMenu;
