"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import Toggle, { type ToggleOption } from "@/components/ui/toggle";

const subscribe = () => () => {};

const OPTIONS: [ToggleOption<"light">, ToggleOption<"dark">] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Light/dark slider: the generic Toggle wired to next-themes. Shows the light
// position until mounted so server and client markup match.
const ThemeSwitch = ({ compact = false, className }: { compact?: boolean; className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const value = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toggle<"light" | "dark">
      value={value}
      onChange={setTheme}
      options={OPTIONS}
      ariaLabel="Colour scheme"
      compact={compact}
      className={className}
    />
  );
};

export default ThemeSwitch;
