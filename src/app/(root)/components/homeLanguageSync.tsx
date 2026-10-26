"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useHomeLocale } from "@/components/providers/i18nProvider";
import { rememberHomeLocale, rememberLocale } from "@/lib/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { saveHomeLanguage } from "@/lib/actions/language.action";

/**
 * Keeps the person's own language the same on this device and on their login:
 * a new device learns it from the login (and opens in it, unless a language
 * was already picked here); a language picked here (or at sign-up, before the
 * login existed) is saved to the login.
 */
const HomeLanguageSync = ({ saved }: { saved: Locale | null }) => {
  const here = useHomeLocale();
  const router = useRouter();

  useEffect(() => {
    if (saved && !here) {
      rememberHomeLocale(saved);
      if (!document.cookie.split("; ").some((c) => c.startsWith(`${LOCALE_COOKIE}=`))) {
        rememberLocale(saved);
        router.refresh();
      }
    } else if (here && here !== saved) {
      void saveHomeLanguage({ locale: here });
    }
  }, [saved, here, router]);

  return null;
};

export default HomeLanguageSync;
