"use client";

import { Moon, Sun } from "lucide-react";

import { useT } from "@/components/i18nProvider";
import { cn } from "@/lib/utils";

// Slow, soft slide for both discs. Inline so no utility class can be dropped.
const SLIDE: React.CSSProperties = { transitionDuration: "600ms", transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" };

interface ThemeToggleProps {
  isDark: boolean;
  onChange: (isDark: boolean) => void;
  className?: string;
}

/**
 * Sun/moon pill: the active icon sits in a raised disc that slides across
 * while the inactive icon fades on the other side. Controlled from outside
 * (next-themes in ThemeSwitch). Colours come from the theme tokens, and the
 * slide is deliberately slow (600 ms) so the hand-off reads.
 */
export function ThemeToggle({ isDark, onChange, className }: ThemeToggleProps) {
  const t = useT();
  const toggle = () => onChange(!isDark);

  return (
    <div
      className={cn(
        "flex h-8 w-16 cursor-pointer rounded-full border p-1 transition-colors",
        isDark ? "border-line bg-surface-lowest" : "border-line bg-card",
        className
      )}
      style={SLIDE}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      role="switch"
      aria-checked={isDark}
      aria-label={t("common.darkMode")}
      tabIndex={0}
    >
      <div className="flex w-full items-center justify-between">
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full transition-transform",
            isDark ? "translate-x-0 bg-surface-high" : "translate-x-8 bg-primary"
          )}
          style={SLIDE}
        >
          {isDark ? <Moon className="size-4 text-ink" strokeWidth={1.5} /> : <Sun className="size-4 text-primary-foreground" strokeWidth={1.5} />}
        </div>
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full transition-transform",
            isDark ? "translate-x-0" : "-translate-x-8"
          )}
          style={SLIDE}
        >
          {isDark ? <Sun className="size-4 text-ink-faint" strokeWidth={1.5} /> : <Moon className="size-4 text-ink-faint" strokeWidth={1.5} />}
        </div>
      </div>
    </div>
  );
}

export default ThemeToggle;
