"use client";

import { useId } from "react";

import { useT } from "@/components/i18nProvider";
import { cn } from "@/lib/utils";

export type ToggleOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: [ToggleOption<T>, ToggleOption<T>];
  ariaLabel?: string;
  className?: string;
  // Hide the two labels (the switch alone), for tight spots like the phone top bar.
  compact?: boolean;
};

/**
 * Two-way switch ported from the Lazy I's Studio portfolio: label · switch ·
 * label. The knob is one SVG path whose dash offset and vertical flip animate
 * between the ends (see ".vtoggle" in globals.css). Colours come from the
 * theme tokens, so it works in light and dark: track = primary, knob = lime.
 */
const Toggle = <T extends string>({ value, onChange, options, ariaLabel, className, compact = false }: Props<T>) => {
  const id = useId();
  const t = useT();
  const [a, b] = options;
  const checked = value === b.value;

  const labelClass = (active: boolean) =>
    cn(
      "font-mono text-[12px] uppercase tracking-[0.14em] transition-colors",
      active ? "font-semibold text-ink" : "text-ink-faint hover:text-ink",
      compact && "sr-only"
    );

  return (
    <div className={cn("inline-flex items-center gap-3", className)} role="group" aria-label={ariaLabel ?? t("common.switchView")}>
      <button type="button" onClick={() => onChange(a.value)} className={labelClass(!checked)}>
        {a.label}
      </button>

      <span className="vtoggle-wrap">
        <input
          id={id}
          type="checkbox"
          className="vtoggle-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? b.value : a.value)}
          aria-label={t("common.eitherOr", { first: a.label, second: b.label })}
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

      <button type="button" onClick={() => onChange(b.value)} className={labelClass(checked)}>
        {b.label}
      </button>
    </div>
  );
};

export default Toggle;
