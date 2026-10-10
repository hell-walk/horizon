"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useT } from "@/components/i18nProvider";
import { moreLinks, sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";

const isActive = (pathname: string, route: string) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));

/** What sits behind "More": on phones also the main links that do not fit the bottom bar. */
const linksFor = (variant: "bar" | "bottom") => (variant === "bottom" ? [...sidebarLinks.filter((l) => l.phone === false), ...moreLinks] : moreLinks);

/**
 * "More" (three dots). In the desktop pill it opens a small menu under the
 * button; in the phone's bottom bar it slides a panel up from the bottom.
 * Either way it closes on Esc, on a click outside and when a link is chosen.
 */
const MoreMenu = ({ variant }: { variant: "bar" | "bottom" }) => {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = linksFor(variant);
  const current = links.some((l) => isActive(pathname, l.route));

  const list = (
    <ul className="flex flex-col gap-1">
      {links.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.route);
        return (
          <li key={item.route}>
            <Link
              href={item.route}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-14 transition-colors",
                active ? "bg-lime text-lime-foreground" : "text-ink hover:bg-surface-container",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "bottom") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label={t("nav.moreTitle")}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-full transition-[background-color,color,padding] duration-300",
            current ? "bg-lime px-4 text-lime-foreground" : "w-11 text-primary-foreground/70 hover:text-primary-foreground",
          )}
        >
          <MoreHorizontal className="size-[18px] shrink-0" strokeWidth={current ? 2.25 : 1.75} />
          {current && <span className="font-display text-12 font-semibold uppercase tracking-wide">{t("nav.more")}</span>}
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-lg border-line bg-surface-low px-4 pb-8 pt-5">
          <SheetTitle className="eyebrow mb-3 text-ink">{t("nav.moreTitle")}</SheetTitle>
          {list}
        </SheetContent>
      </Sheet>
    );
  }

  return <BarMenu open={open} setOpen={setOpen} current={current} list={list} />;
};

/** The desktop menu: a button with the three dots and a small list under it. */
const BarMenu = ({ open, setOpen, current, list }: { open: boolean; setOpen: (open: boolean) => void; current: boolean; list: React.ReactNode }) => {
  const t = useT();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    // Move into the list so keyboard users land on the first option.
    box.current?.querySelector<HTMLElement>(`#${CSS.escape(id)} a`)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, setOpen, id]);

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-current={current ? "page" : undefined}
        aria-label={t("nav.moreTitle")}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors",
          current || open ? "text-ink" : "text-ink-faint hover:text-ink",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
        <span className="hidden lg:inline">{t("nav.more")}</span>
      </button>
      {open && (
        <div id={id} className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-line bg-surface-low p-2 shadow-lift">
          {list}
        </div>
      )}
    </div>
  );
};

export default MoreMenu;
