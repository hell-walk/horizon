"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18nProvider";
import { sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Floating pill navigation, ported from the Lazy I's portfolio navbar. A lime
 * line sits under the active link and slides between links when the route
 * changes.
 */
const Navbar = ({ className }: { className?: string }) => {
  const pathname = usePathname();
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ left: number; width: number } | null>(null);

  const isActive = (route: string) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));

  // Measure the active link so the underline can slide to it. Re-measured on
  // resize because the labels change length at the md breakpoint.
  useEffect(() => {
    const measure = () => {
      const list = listRef.current;
      const active = list?.querySelector<HTMLElement>("a[aria-current='page']");
      if (!list || !active) {
        setLine(null);
        return;
      }
      const listRect = list.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      setLine({ left: rect.left - listRect.left + 12, width: Math.max(rect.width - 24, 8) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <nav
      aria-label={t("nav.mainMenu")}
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-card/80 px-1.5 py-1 shadow-lift backdrop-blur-md",
        className
      )}
    >
      <div ref={listRef} className="relative flex items-center">
        {sidebarLinks.map((item) => {
          const active = isActive(item.route);
          return (
            <Link
              key={item.route}
              href={item.route}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors",
                active ? "text-ink" : "text-ink-faint hover:text-ink"
              )}
            >
              <span className="lg:hidden">{t(item.shortKey)}</span>
              <span className="hidden lg:inline">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        {line && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[3px] h-[2px] rounded-full bg-lime transition-[left,width] duration-300"
            style={{ left: line.left, width: line.width, transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
