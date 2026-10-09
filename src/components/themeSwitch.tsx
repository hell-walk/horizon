"use client";

import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import SkyToggle from "@/components/ui/sky-toggle";
import { ThemeToggle as PillToggle } from "@/components/ui/theme-toggle";
import Toggle, { type ToggleOption } from "@/components/ui/toggle";
import { THEME_SWITCH_VARIANT } from "@/constants";

const subscribe = () => () => {};

// How long the switch gets to animate before the page theme flips. Flipping
// the theme restyles the whole page, which stalls any transition running at
// that moment, so the switch moves first and the page follows.
const FLIP_DELAY_MS = 420;

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
    window.setTimeout(() => setTheme(night ? "dark" : "light"), FLIP_DELAY_MS);
  };

  if (THEME_SWITCH_VARIANT === "pill") {
    return <PillToggle isDark={shownDark} onChange={flip} className={className} />;
  }

  if (THEME_SWITCH_VARIANT === "sky") {
    return <SkyToggle checked={shownDark} onChange={flip} ariaLabel="Dark mode" className={className} />;
  }

  return (
    <Toggle<"light" | "dark">
      value={shownDark ? "dark" : "light"}
      onChange={(value) => flip(value === "dark")}
      options={OPTIONS}
      ariaLabel="Colour scheme"
      compact={compact}
      className={className}
    />
  );
};

export default ThemeSwitch;
