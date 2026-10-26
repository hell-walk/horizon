"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useT } from "@/components/providers/i18nProvider";

export const CHECKS_SEEN_COOKIE = "horizon-checks-seen";

/** The bar with its close button: closing hides it until tomorrow (the server reads the cookie). */
const ChecksBarClose = ({ today, children }: { today: string; children: ReactNode }) => {
  const t = useT();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={() => {
          document.cookie = `${CHECKS_SEEN_COOKIE}=${today}; path=/; max-age=86400; samesite=lax`;
          setOpen(false);
        }}
        aria-label={t("home.checksBarClose")}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-warn-ink transition-colors hover:bg-black/10 sm:right-2"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
};

export default ChecksBarClose;
