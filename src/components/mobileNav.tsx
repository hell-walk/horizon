"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

import Footer from "./footer";
import Logo from "./logo";

// Slide-in menu for screens narrower than the sidebar breakpoint.
const MobileNav = ({ user }: MobileNavProps) => {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Open menu"
        className="flex-center size-9 rounded-md border border-line bg-card text-ink-muted hover:bg-surface-container hover:text-ink"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[300px] flex-col gap-6 border-line bg-surface-low p-5">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Logo />

        <nav className="flex flex-1 flex-col gap-1">
          {sidebarLinks.map((item, index) => {
            const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
            const Icon = item.icon;
            return (
              <SheetClose asChild key={item.route}>
                <Link
                  href={item.route}
                  className={cn("sidebar-link justify-between", { "sidebar-link-active": isActive })}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                    {item.label}
                  </span>
                  <span className="font-mono text-[10px] opacity-50">{String(index + 1).padStart(2, "0")}</span>
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <Footer user={user} type="mobile" />
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
