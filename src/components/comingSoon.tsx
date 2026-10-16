import type { ReactNode } from "react";

import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// Something built but not yet open: shown blurred and inert, with "Coming
// soon" over it, so people see what is on the way without being able to use
// it. Same on phones and desktops.
export default async function ComingSoon({ children, className }: { children: ReactNode; className?: string }) {
  const t = await getT();
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden inert className="pointer-events-none select-none opacity-60 blur-[3px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface-low/95 px-5 py-4 text-center shadow-lift">
          <span className="chip chip-lime">{t("common.comingSoon")}</span>
          <p className="max-w-xs text-13 text-ink-muted">{t("common.comingSoonBody")}</p>
        </div>
      </div>
    </div>
  );
}
