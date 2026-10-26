import type { ReactNode } from "react";

import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// Something built but not yet open: shown blurred and inert, with "Coming
// soon" over it, so people see what is on the way without being able to use
// it. Same on phones and desktops.
/** `badgeTop`: where the label sits, from the top (a CSS length), for tall content; centred when absent. */
export default async function ComingSoon({ children, className, badgeTop }: { children: ReactNode; className?: string; badgeTop?: string }) {
  const t = await getT();
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden inert className="pointer-events-none select-none opacity-60 blur-[3px]">
        {children}
      </div>
      <div className={cn("absolute inset-x-0 flex justify-center p-4", badgeTop ? "" : "inset-y-0 items-center")} style={badgeTop ? { top: badgeTop } : undefined}>
        <span className="chip chip-lime px-4 py-2 text-13 shadow-lift">{t("common.comingSoon")}</span>
      </div>
    </div>
  );
}
