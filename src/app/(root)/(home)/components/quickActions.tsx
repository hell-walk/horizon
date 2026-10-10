import { CalendarClock, FileUp, Target } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";

// Statement upload first: it is how most people keep Horizon up to date. Sending money
// (US only) and connecting a bank are in the menus.
const ACTIONS = [
  { labelKey: "home.actionUpload", href: "/connect-bank#statement", icon: FileUp },
  { labelKey: "nav.bills", href: "/bills", icon: CalendarClock },
  { labelKey: "nav.goals", href: "/goals", icon: Target },
];

// Three shortcut cards under the Home header.
const QuickActions = async () => {
  const t = await getT();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3 transition-colors hover:border-primary"
          >
            <span className="flex flex-col gap-1">
              <span className="eyebrow">{t("home.quickAction")}</span>
              <span className="text-14 font-semibold text-ink">{t(action.labelKey)}</span>
            </span>
            <span className="flex-center size-9 rounded-md bg-surface-container text-ink-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" />
            </span>
          </Link>
        );
      })}
    </div>
  );
};

export default QuickActions;
