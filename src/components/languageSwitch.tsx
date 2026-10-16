"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { rememberLocale } from "@/lib/i18n/client";
import { LOCALE_ENGLISH_NAMES, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useLocale, useT } from "./i18nProvider";
import { ProgressDoughnut } from "./loaders";

/**
 * The language picker. A button opens a list of the eleven languages, each in
 * its own script with its English name under it and a tick on the current one.
 * Arrow keys, Home/End, Enter and Escape work; a click outside closes it.
 * Choosing one remembers it for a year and re-renders the page in place,
 * with the page-loading ring over it until the new language has arrived.
 * `compact`: the button shows the icon and the language's code (top bars, phones).
 */
const LanguageSwitch = ({ className, compact = false }: { className?: string; compact?: boolean }) => {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Phones: the list opens full width under the button instead of hanging off its right edge.
  const [phoneTop, setPhoneTop] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Focus follows the highlighted language while the list is open.
  useEffect(() => {
    if (open) items.current[active]?.focus();
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, LOCALES.indexOf(locale)));
    const rect = button.current?.getBoundingClientRect();
    setPhoneTop(rect && window.innerWidth < 640 ? Math.round(rect.bottom + 8) : null);
    setOpen(true);
  };

  const choose = (next: Locale) => {
    setOpen(false);
    button.current?.focus();
    if (next === locale) return;
    rememberLocale(next);
    startTransition(() => router.refresh());
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = LOCALES.length - 1;
    if (e.key === "ArrowDown") setActive((i) => (i >= last ? 0 : i + 1));
    else if (e.key === "ArrowUp") setActive((i) => (i <= 0 ? last : i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t("common.language")}: ${LOCALE_NAMES[locale]}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex h-8 items-center gap-1.5 border border-line bg-card text-ink transition-colors hover:bg-surface-container focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
          compact ? "rounded-full px-2.5" : "rounded-sm px-2.5",
          open && "bg-surface-container",
        )}
      >
        <Languages className="size-4 shrink-0 text-ink-muted" aria-hidden />
        {compact ? (
          <span className="font-mono text-12 font-semibold uppercase" aria-hidden>
            {locale}
          </span>
        ) : (
          <span lang={locale} className="text-13 font-semibold" aria-hidden>
            {LOCALE_NAMES[locale]}
          </span>
        )}
        <ChevronDown className={cn("size-3.5 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("common.language")}
          onKeyDown={onListKey}
          style={phoneTop !== null ? { position: "fixed", top: phoneTop, left: 16, right: 16, width: "auto", marginTop: 0 } : undefined}
          className="absolute right-0 top-full z-50 mt-2 grid max-h-[min(70vh,560px)] w-[min(20rem,calc(100vw-2rem))] grid-cols-1 gap-0.5 overflow-y-auto rounded-md border border-line bg-surface-low p-1.5 shadow-lift sm:w-[26rem] sm:grid-cols-2"
        >
          {LOCALES.map((code, i) => {
            const current = code === locale;
            return (
              <li key={code} role="presentation">
                <button
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={current}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => choose(code)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors focus-visible:outline-hidden",
                    i === active ? "bg-surface-container" : "hover:bg-surface-container",
                    current && "bg-lime/25",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span lang={code} className="truncate text-16 font-semibold leading-snug text-ink">
                      {LOCALE_NAMES[code]}
                    </span>
                    <span className="eyebrow">{LOCALE_ENGLISH_NAMES[code]}</span>
                  </span>
                  {current && <Check className="size-4 shrink-0 text-ink" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* While the page re-renders in the new language: the page-loading ring over everything. */}
      {pending &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface/80 backdrop-blur-sm" aria-live="polite">
            <ProgressDoughnut />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default LanguageSwitch;
