"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

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
  const toggle = () => onChange(!isDark);

  return (
    <div
      className={cn(
        "flex h-8 w-16 cursor-pointer rounded-full border p-1 transition-colors duration-500",
        isDark ? "border-line bg-surface-lowest" : "border-line bg-card",
        className
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      tabIndex={0}
    >
      <div className="flex w-full items-center justify-between">
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            isDark ? "translate-x-0 bg-surface-high" : "translate-x-8 bg-primary"
          )}
        >
          {isDark ? <Moon className="size-4 text-ink" strokeWidth={1.5} /> : <Sun className="size-4 text-primary-foreground" strokeWidth={1.5} />}
        </div>
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            isDark ? "translate-x-0" : "-translate-x-8"
          )}
        >
          {isDark ? <Sun className="size-4 text-ink-faint" strokeWidth={1.5} /> : <Moon className="size-4 text-ink-faint" strokeWidth={1.5} />}
        </div>
      </div>
    </div>
  );
}

export default ThemeToggle;
