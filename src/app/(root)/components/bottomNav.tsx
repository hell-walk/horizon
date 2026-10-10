"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/components/i18nProvider";
import { sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Phone navigation: a floating black pill at the bottom of the screen. The
 * active item grows into a lime chip with its label; the others stay as icons.
 */
const BottomNav = () => {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 md:hidden">
      <nav
        aria-label={t("nav.mainMenu")}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-primary p-1.5 shadow-lift ring-1 ring-primary-foreground/10"
      >
        {sidebarLinks.map((item) => {
          const active = pathname === item.route || (item.route !== "/" && pathname.startsWith(`${item.route}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.route}
              href={item.route}
              aria-current={active ? "page" : undefined}
              aria-label={t(item.labelKey)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-full transition-[background-color,color,padding] duration-300",
                active ? "bg-lime px-4 text-lime-foreground" : "w-11 text-primary-foreground/70 hover:text-primary-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              {active && <span className="font-display text-12 font-semibold uppercase tracking-wide">{t(item.shortKey)}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
