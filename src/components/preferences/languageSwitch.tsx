"use client";

import { Check, ChevronDown, Languages, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { rememberHomeLocale, rememberLocale } from "@/lib/i18n/client";
import { EVERYONE_LOCALES, LOCALE_ENGLISH_NAMES, LOCALE_NAMES, LOCALES, pickerLocales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useHomeLocale, useLocale, useT } from "../providers/i18nProvider";
import { ProgressDoughnut } from "../ui/loaders";

/**
 * The language picker. A button opens a list of the eleven languages, each in
 * its own script with its English name under it and a tick on the current one.
 * Arrow keys, Home/End, Enter and Escape work; a click outside closes it.
 * Choosing one remembers it for a year and re-renders the page in place,
 * with the page-loading ring over it until the new language has arrived.
 * `compact`: the button shows the icon and the language's code (top bars, phones).
 *
 * Once the person's own regional language is known (chosen at sign-up, or the
 * last regional language picked here), the list is just that, Hindi and
 * English, with "More languages" for the rest.
 */
const LanguageSwitch = ({ className, compact = false }: { className?: string; compact?: boolean }) => {
  const locale = useLocale();
  const home = useHomeLocale();
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? [...LOCALES] : pickerLocales(home, locale);
  const hasMore = shown.length < LOCALES.length;
  // The options, then "More languages" when the list is short.
  const last = shown.length - (hasMore ? 0 : 1);
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
    setShowAll(false);
    setActive(Math.max(0, pickerLocales(home, locale).indexOf(locale)));
    const rect = button.current?.getBoundingClientRect();
    setPhoneTop(rect && window.innerWidth < 640 ? Math.round(rect.bottom + 8) : null);
    setOpen(true);
  };

  const choose = (next: Locale) => {
    setOpen(false);
    button.current?.focus();
    if (next === locale) return;
    rememberLocale(next);
    // A regional language becomes their own: the picker leads with it from now on (and the login keeps it).
    if (!EVERYONE_LOCALES.includes(next)) rememberHomeLocale(next);
    startTransition(() => router.refresh());
  };

  const showMore = () => {
    setShowAll(true);
    setActive(shown.length); // the first language that was hidden
  };

  const onListKey = (e: KeyboardEvent) => {
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
          className={cn(
            "absolute right-0 top-full z-50 mt-2 grid max-h-[min(70vh,560px)] w-[min(20rem,calc(100vw-2rem))] grid-cols-1 gap-0.5 overflow-y-auto rounded-md border border-line bg-surface-low p-1.5 shadow-lift",
            showAll || !home ? "sm:w-[26rem] sm:grid-cols-2" : "sm:w-[18rem]",
          )}
        >
          {shown.map((code, i) => {
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
          {hasMore && (
            <li role="presentation" className={cn(showAll || !home ? "sm:col-span-2" : "")}>
              <button
                ref={(el) => {
                  items.current[shown.length] = el;
                }}
                type="button"
                role="option"
                aria-selected={false}
                tabIndex={active === shown.length ? 0 : -1}
                onClick={showMore}
                onMouseEnter={() => setActive(shown.length)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-sm border-t border-line px-3 py-2.5 text-left text-14 font-semibold text-ink transition-colors focus-visible:outline-hidden",
                  active === shown.length ? "bg-surface-container" : "hover:bg-surface-container",
                )}
              >
                <Plus className="size-4 shrink-0 text-ink-muted" aria-hidden /> {t("common.moreLanguages")}
              </button>
            </li>
          )}
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
