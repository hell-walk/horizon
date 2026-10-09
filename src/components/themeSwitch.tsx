"use client";

import { useTheme } from "next-themes";
import { useRef, useState, useSyncExternalStore } from "react";

import SkyToggle from "@/components/ui/sky-toggle";
import { ThemeToggle as PillToggle } from "@/components/ui/theme-toggle";
import Toggle, { type ToggleOption } from "@/components/ui/toggle";
import { THEME_SWITCH_VARIANT } from "@/constants";

const subscribe = () => () => {};

// The switch starts moving first; a beat later the theme flips inside a view
// transition (globals.css): going dark, the dark page grows out of the switch
// in a circle; going light, the dark page shrinks back into the switch. Pixels
// are old or new, never blended, so nothing passes through grey.
const FLIP_DELAY_MS = 120;

const OPTIONS: [ToggleOption<"light">, ToggleOption<"dark">] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type DocWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
};

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
  const anchor = useRef<HTMLSpanElement>(null);

  // The position the switch shows while the theme change is still pending.
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === isDark) setPending(null); // theme caught up
  const shownDark = pending ?? isDark;

  const flip = (night: boolean) => {
    if (night === shownDark) return;
    setPending(night);

    const root = document.documentElement;
    const doc = document as DocWithViewTransition;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Apply the class ourselves inside the transition so the snapshot is taken
    // at the right moment; next-themes then sets the same class and persists it.
    const apply = () => {
      root.classList.toggle("dark", night);
      root.classList.toggle("light", !night);
      setTheme(night ? "dark" : "light");
    };

    window.setTimeout(() => {
      if (!doc.startViewTransition || reduceMotion) {
        apply();
        return;
      }

      // Centre of the switch, and a radius that reaches the farthest corner.
      const el = anchor.current?.firstElementChild ?? anchor.current;
      const rect = el?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-r", `${r}px`);

      // Direction picks the animation: grow the new page, or shrink the old one.
      root.dataset.themeFlip = night ? "dark" : "light";

      // The browser skips the animation in a hidden tab (the class still
      // applies); swallow that rejection so it does not surface as an error.
      const transition = doc.startViewTransition(apply);
      transition.ready.catch(() => {});
      transition.finished.catch(() => {}).finally(() => delete root.dataset.themeFlip);
    }, FLIP_DELAY_MS);
  };

  let control;
  if (THEME_SWITCH_VARIANT === "pill") {
    control = <PillToggle isDark={shownDark} onChange={flip} className={className} />;
  } else if (THEME_SWITCH_VARIANT === "sky") {
    control = <SkyToggle checked={shownDark} onChange={flip} ariaLabel="Dark mode" className={className} />;
  } else {
    control = (
      <Toggle<"light" | "dark">
        value={shownDark ? "dark" : "light"}
        onChange={(value) => flip(value === "dark")}
        options={OPTIONS}
        ariaLabel="Colour scheme"
        compact={compact}
        className={className}
      />
    );
  }

  // display: contents keeps the wrapper out of the layout; it only gives us
  // a handle on the control's position.
  return (
    <span ref={anchor} className="contents">
      {control}
    </span>
  );
};

export default ThemeSwitch;
