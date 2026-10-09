"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";

// Chart.js paints on a canvas, so it needs real colour values. These are read
// from the CSS variables in globals.css and re-read whenever the theme flips.
const TOKEN_NAMES = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"] as const;

export type ChartColors = {
  segments: string[];
  other: string;
  track: string;
  text: string;
  mutedText: string;
  card: string;
};

const FALLBACK: ChartColors = {
  segments: ["#7C5CFF", "#A6D600", "#F24400", "#00B8A9", "#FF4D8D", "#FFB020"],
  other: "#C7C6CB",
  track: "#EEEEEA",
  text: "#1A1C1A",
  mutedText: "#77777B",
  card: "#FFFFFF",
};

const readToken = (styles: CSSStyleDeclaration, name: string, fallback: string) => {
  const value = styles.getPropertyValue(`--${name}`).trim();
  return value ? `rgb(${value})` : fallback;
};

const readColors = (): ChartColors => {
  const styles = getComputedStyle(document.documentElement);
  return {
    segments: TOKEN_NAMES.map((name, i) => readToken(styles, name, FALLBACK.segments[i])),
    other: readToken(styles, "chart-other", FALLBACK.other),
    track: readToken(styles, "surface-container", FALLBACK.track),
    text: readToken(styles, "on-surface", FALLBACK.text),
    mutedText: readToken(styles, "outline", FALLBACK.mutedText),
    card: readToken(styles, "surface-lowest", FALLBACK.card),
  };
};

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();

  // The charts are client-only (dynamic import without SSR), so the DOM is
  // available here; resolvedTheme changes after the class on <html> does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (typeof window === "undefined" ? FALLBACK : readColors()), [resolvedTheme]);
}

/** Canvas colour for a chart segment, matching chartColorClass. */
export const segmentColor = (colors: ChartColors, name: string, index: number) =>
  name === "Other" ? colors.other : colors.segments[index % colors.segments.length];

/** Entrance animation for every doughnut: spins round while growing from the centre. */
export const ENTRANCE = { animateRotate: true, animateScale: true, duration: 900, easing: "easeOutQuart" as const };
