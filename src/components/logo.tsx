import Link from "next/link";

import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

import LogoMark from "./logoMark";

// Wordmark with the diamond mark. `compact` shows the mark only (narrow sidebar).
// Server only: every place that shows it (layouts, top bar, 404) is a server component.
const Logo = async ({ compact = false, className, href = "/" }: { compact?: boolean; className?: string; href?: string }) => {
  const t = await getT();

  return (
    <Link href={href} aria-label={t("common.logoHome")} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span translate="no" className="whitespace-nowrap font-display text-18 font-bold uppercase tracking-tight text-ink">
            Horizon
          </span>
          <span className="eyebrow mt-1 whitespace-nowrap">{t("common.logoTagline")}</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
