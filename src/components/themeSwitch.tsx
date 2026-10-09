"use client";

import { useTheme } from "next-themes";
import { useId, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/**
 * Light/dark slider. The knob is a single SVG path animated by CSS (see
 * ".vtoggle" in globals.css). Labels sit either side and are clickable too;
 * `compact` hides them for tight spots like the phone top bar.
 */
const ThemeSwitch = ({ compact = false, className }: { compact?: boolean; className?: string }) => {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  const labelClass = (active: boolean) =>
    cn(
      "font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
      active ? "font-semibold text-ink" : "text-ink-faint hover:text-ink",
      compact && "sr-only"
    );

  return (
    <div className={cn("inline-flex items-center gap-3", className)} role="group" aria-label="Colour scheme">
      <button type="button" onClick={() => setTheme("light")} className={labelClass(!isDark)}>
        Light
      </button>

      <span className="vtoggle-wrap">
        <input
          id={id}
          type="checkbox"
          className="vtoggle-input"
          checked={isDark}
          onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
          aria-label="Dark mode"
        />
        <label className="vtoggle" htmlFor={id}>
          <svg viewBox="0 0 212.4992 84.4688" overflow="visible" aria-hidden="true">
            <path
              pathLength={360}
              fill="none"
              stroke="currentColor"
              d="M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0"
            />
          </svg>
        </label>
      </span>

      <button type="button" onClick={() => setTheme("dark")} className={labelClass(isDark)}>
        Dark
      </button>
    </div>
  );
};

export default ThemeSwitch;
