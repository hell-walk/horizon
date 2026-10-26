"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useHomeLocale, useLocale, useT } from "@/components/providers/i18nProvider";
import { rememberHomeLocale, rememberLocale } from "@/lib/i18n/client";
import { isLocale, LOCALE_ENGLISH_NAMES, LOCALE_NAMES, LOCALES } from "@/lib/i18n/config";

/**
 * "Your language" on the sign-up and welcome forms. Choosing one switches the
 * page at once (what has been typed stays) and makes it the person's own
 * language: from then on the picker offers just it, English and Hindi, and
 * the login keeps it once it exists. Not part of the form's own fields.
 */
const LanguageField = () => {
  const t = useT();
  const locale = useLocale();
  const home = useHomeLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (value: string) => {
    if (!isLocale(value)) return;
    rememberHomeLocale(value);
    rememberLocale(value);
    startTransition(() => router.refresh());
  };

  return (
    <div className="field sm:col-span-2">
      <label className="field-label" htmlFor="signup-language">
        {t("auth.language")}
      </label>
      <select
        id="signup-language"
        value={home ?? locale}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        className="field-input"
        aria-describedby="signup-language-hint"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {code === "en" ? LOCALE_NAMES[code] : `${LOCALE_NAMES[code]} (${LOCALE_ENGLISH_NAMES[code]})`}
          </option>
        ))}
      </select>
      <p id="signup-language-hint" className="field-hint">
        {t("auth.languageHint")}
      </p>
    </div>
  );
};

export default LanguageField;
