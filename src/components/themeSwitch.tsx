"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import SkyToggle from "@/components/ui/sky-toggle";
import Toggle, { type ToggleOption } from "@/components/ui/toggle";
import { THEME_SWITCH_VARIANT } from "@/constants";

const subscribe = () => () => {};

const OPTIONS: [ToggleOption<"light">, ToggleOption<"dark">] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Light/dark control wired to next-themes. Two looks, picked by
 * THEME_SWITCH_VARIANT in constants: "knob" (the portfolio slider with Light
 * and Dark labels) or "sky" (the sun/moon day-night switch). Shows the light
 * position until mounted so server and client markup match.
 */
const ThemeSwitch = ({ compact = false, className }: { compact?: boolean; className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  if (THEME_SWITCH_VARIANT === "sky") {
    return <SkyToggle checked={isDark} onChange={(night) => setTheme(night ? "dark" : "light")} ariaLabel="Dark mode" className={className} />;
  }

  return (
    <Toggle<"light" | "dark">
      value={isDark ? "dark" : "light"}
      onChange={setTheme}
      options={OPTIONS}
      ariaLabel="Colour scheme"
      compact={compact}
      className={className}
    />
  );
};

export default ThemeSwitch;
