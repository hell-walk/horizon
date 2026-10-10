"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { logoutAccount } from "@/lib/actions/user.action";

import ThemeSwitch from "@/components/themeSwitch";

// Avatar button in the top bar. Opens a panel with the account, the theme
// slider (useful on phones, where the bar has no room for it) and log out.
const UserMenu = ({ user }: { user: User }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || user.name?.[0] || "?";

  const handleLogOut = async () => {
    const loggedOut = await logoutAccount();
    if (loggedOut) router.push("/sign-in");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Account menu"
        className="flex-center size-9 rounded-full bg-primary font-display text-12 font-bold text-primary-foreground transition-opacity hover:opacity-85"
      >
        {initials}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[320px] flex-col gap-6 border-line bg-surface-low p-5 sm:max-w-sm">
        <SheetTitle className="sr-only">Account</SheetTitle>

        <div className="flex items-center gap-3 pt-6">
          <div className="flex-center size-12 shrink-0 rounded-sm bg-primary font-display text-16 font-bold text-primary-foreground">{initials}</div>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-16 font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-12 text-ink-muted">{user.email}</p>
            <span className="chip-lime mt-1 w-fit">
              <ShieldCheck className="size-3" /> Verified
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-line bg-card px-3 py-2.5">
          <span className="eyebrow">Appearance</span>
          <ThemeSwitch />
        </div>

        <div className="flex flex-col gap-1">
          <Link href="/connect-bank" onClick={() => setOpen(false)} className="btn-secondary justify-start">
            Connect a bank
          </Link>
          <Link href="/privacy" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            Privacy policy
          </Link>
          <Link href="/terms" onClick={() => setOpen(false)} className="btn-ghost justify-start">
            Terms
          </Link>
        </div>

        <button type="button" onClick={handleLogOut} className="btn-primary mt-auto w-full">
          <LogOut className="size-4" /> Log out
        </button>
      </SheetContent>
    </Sheet>
  );
};

export default UserMenu;
