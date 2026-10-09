"use client";

import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import SkyToggle from "@/components/ui/sky-toggle";
import { ThemeToggle as PillToggle } from "@/components/ui/theme-toggle";
import Toggle, { type ToggleOption } from "@/components/ui/toggle";
import { THEME_SWITCH_VARIANT } from "@/constants";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

// The switch starts moving first; a beat later the theme flips with every
// colour easing over the same 600 ms curve (see .theme-transition in
// globals.css), so the page fades in step with the disc.
const FLIP_DELAY_MS = 120;
const FADE_MS = 600;

const OPTIONS: [ToggleOption<"light">, ToggleOption<"dark">] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Light/dark control wired to next-themes. Three looks, picked by
 * THEME_SWITCH_VARIANT in constants: "knob" (the portfolio slider with Light
 * and Dark labels), "sky" (the sun/moon day-night switch) or "pill" (lucide
 * sun/moon in a sliding disc). Shows the light position until mounted so
 * server and client markup match.
 */
const ThemeSwitch = ({ compact = false, className }: { compact?: boolean; className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  // The position the switch shows while the theme change is still pending.
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === isDark) setPending(null); // theme caught up
  const shownDark = pending ?? isDark;

  const flip = (night: boolean) => {
    if (night === shownDark) return;
    setPending(night);
    const root = document.documentElement;
    window.setTimeout(() => {
      root.classList.add("theme-transition");
      setTheme(night ? "dark" : "light");
      window.setTimeout(() => root.classList.remove("theme-transition"), FADE_MS + 100);
    }, FLIP_DELAY_MS);
  };

  if (THEME_SWITCH_VARIANT === "pill") {
    return <PillToggle isDark={shownDark} onChange={flip} className={cn("no-theme-transition", className)} />;
  }

  if (THEME_SWITCH_VARIANT === "sky") {
    return <SkyToggle checked={shownDark} onChange={flip} ariaLabel="Dark mode" className={cn("no-theme-transition", className)} />;
  }

  return (
    <Toggle<"light" | "dark">
      value={shownDark ? "dark" : "light"}
      onChange={(value) => flip(value === "dark")}
      options={OPTIONS}
      ariaLabel="Colour scheme"
      compact={compact}
      className={cn("no-theme-transition", className)}
    />
  );
};

export default ThemeSwitch;
