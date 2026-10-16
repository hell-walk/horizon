"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import { rememberLocale } from "@/lib/i18n/client";
import { isLocale, LOCALE_NAMES, LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useLocale, useT } from "./i18nProvider";

/**
 * The language picker: a native select (eleven languages, each written in
 * itself), so it works the same with a mouse, a keyboard, a screen reader and
 * a phone's own picker. Remembered for a year; the page re-renders in place.
 * `compact`: a small pill with the icon and the language's code (for top bars
 * and phones); the select covers it, invisible, so a tap opens the same list.
 */
const LanguageSwitch = ({ className, compact = false }: { className?: string; compact?: boolean }) => {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();

  const choose = (next: string) => {
    if (!isLocale(next) || next === locale) return;
    rememberLocale(next);
    startTransition(() => router.refresh());
  };

  if (compact) {
    return (
      <div className={cn("relative flex h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-ink-muted transition-colors hover:bg-surface-container has-focus-visible:ring-2 has-focus-visible:ring-primary", pending && "opacity-60", className)}>
        <Languages className="size-4 shrink-0" aria-hidden />
        <span className="font-mono text-12 font-semibold uppercase text-ink" aria-hidden>
          {locale}
        </span>
        <ChevronDown className="size-3 shrink-0" aria-hidden />
        <label htmlFor={id} className="sr-only">
          {t("common.language")}
        </label>
        <select
          id={id}
          value={locale}
          onChange={(e) => choose(e.target.value)}
          disabled={pending}
          className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        >
          {LOCALES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center", pending && "opacity-60", className)}>
      <label htmlFor={id} className="sr-only">
        {t("common.language")}
      </label>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-ink-muted" aria-hidden />
      <select
        id={id}
        value={locale}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        lang={locale}
        className="h-8 cursor-pointer appearance-none rounded-sm border border-line bg-card py-0 pl-8 pr-7 text-13 font-semibold text-ink transition-colors hover:bg-surface-container focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-ink-muted" aria-hidden />
    </div>
  );
};

export default LanguageSwitch;
