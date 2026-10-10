"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useLocale, useT } from "./i18nProvider";

/** English / हिंदी. Remembered for a year; the page re-renders in place. */
const LanguageSwitch = ({ className }: { className?: string }) => {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div role="group" aria-label={t("common.language")} className={cn("flex items-center gap-1", pending && "opacity-60", className)}>
      <Languages className="mr-1 size-4 text-ink-muted" aria-hidden />
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => choose(code)}
          aria-pressed={code === locale}
          className={cn(
            "rounded-sm px-2.5 py-1.5 text-13 font-semibold transition-colors",
            code === locale ? "bg-primary text-primary-foreground" : "text-ink-muted hover:bg-surface-container hover:text-ink"
          )}
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;
