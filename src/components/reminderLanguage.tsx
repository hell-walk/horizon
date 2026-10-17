"use client";

import { Languages } from "lucide-react";
import { useState, useTransition } from "react";

import { setReminderLanguage } from "@/lib/actions/notify.action";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useHomeLocale, useLocale, useT } from "./i18nProvider";

/**
 * Which language reminders arrive in: the person's own language or English.
 * Shown on Home's "Be prepared" (when reminders are on) and in the Reminders
 * settings. Nothing to choose when Horizon is only used in English.
 */
const ReminderLanguage = ({ current, className }: { current: Locale; className?: string }) => {
  const t = useT();
  const home = useHomeLocale();
  const locale = useLocale();
  const regional = home && home !== "en" ? home : locale !== "en" ? locale : current !== "en" ? current : null;
  const [chosen, setChosen] = useState<Locale>(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!regional) return null;

  const choose = (next: Locale) => {
    if (next === chosen) return;
    setError(null);
    const before = chosen;
    setChosen(next);
    startTransition(async () => {
      const result = await setReminderLanguage({ locale: next }).catch(() => ({ ok: false as const, error: t("common.notReachable") }));
      if (!result.ok) {
        setChosen(before);
        setError(result.error);
      }
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-13 text-ink-muted", className)}>
      <Languages className="size-3.5 shrink-0" aria-hidden />
      <span id="reminder-language">{t("remind.languageTitle")}</span>
      <div role="radiogroup" aria-labelledby="reminder-language" className="inline-flex rounded-full border border-line bg-card p-0.5">
        {[regional, "en" as Locale].map((code) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={chosen === code}
            disabled={pending}
            onClick={() => choose(code)}
            lang={code}
            className={cn(
              "rounded-full px-3 py-1 text-12 font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
              chosen === code ? "bg-lime text-lime-foreground" : "text-ink-muted hover:text-ink",
            )}
          >
            {LOCALE_NAMES[code]}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
    </div>
  );
};

export default ReminderLanguage;
