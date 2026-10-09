"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import Logo from "./logo";
import MobileNav from "./mobileNav";
import Navbar from "./navbar";
import ThemeSwitch from "./themeSwitch";

// Thin bar above every signed-in page. On phones it carries the logo and the
// menu. On larger screens it has the sidebar toggle and, while the sidebar is
// collapsed, the floating pill navigation. The theme slider lives here on
// every size.
const Topbar = ({
  user,
  bankCount,
  collapsed,
  onToggle,
}: {
  user: User;
  bankCount: number;
  collapsed: boolean;
  onToggle: () => void;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-low px-4 sm:px-6 lg:px-8">
    <div className="md:hidden">
      <Logo />
    </div>

    <div className="hidden min-w-0 items-center gap-3 md:flex">
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        aria-pressed={collapsed}
        className="flex-center size-9 shrink-0 rounded-md border border-line bg-card text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      {collapsed ? (
        <Navbar />
      ) : (
        <>
          <span className="chip">
            <span className="dot bg-lime" />
            Synced
          </span>
          <span className="eyebrow whitespace-nowrap">
            {bankCount} {bankCount === 1 ? "account" : "accounts"} linked
          </span>
        </>
      )}
    </div>

    <div className="flex shrink-0 items-center gap-3">
      {!collapsed && <span className="hidden text-12 text-ink-muted xl:block">{user.email}</span>}
      <ThemeSwitch className="max-md:hidden" />
      <ThemeSwitch compact className="md:hidden" />
      <div className="md:hidden">
        <MobileNav user={user} />
      </div>
    </div>
  </header>
);

export default Topbar;
