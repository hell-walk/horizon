"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

// Short labels for narrow widths.
const SHORT: Record<string, string> = {
  "/": "Home",
  "/my-banks": "Banks",
  "/transaction-history": "History",
  "/payment-transfer": "Transfer",
  "/connect-bank": "Connect",
};

/**
 * Floating pill navigation, ported from the Lazy I's portfolio navbar: the
 * brand chip, a hairline, then the links. A lime line sits under the active
 * link and slides between links when the route changes.
 */
const Navbar = ({ className }: { className?: string }) => {
  const pathname = usePathname();
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
      aria-label="Site"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-card/80 py-1 pl-1.5 pr-1.5 shadow-lift backdrop-blur-md",
        className
      )}
    >
      <Link href="/" className="group flex items-center gap-2 pr-1">
        <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary-foreground">
          Horizon
        </span>
      </Link>

      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />

      <div ref={listRef} className="relative flex items-center">
        {sidebarLinks.map((item) => {
          const active = isActive(item.route);
          return (
            <Link
              key={item.route}
              href={item.route}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                active ? "text-ink" : "text-ink-faint hover:text-ink"
              )}
            >
              <span className="lg:hidden">{SHORT[item.route] ?? item.label}</span>
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}

        {line && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[3px] h-[2px] rounded-full bg-lime transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ left: line.left, width: line.width }}
          />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
