"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "./i18nProvider";

// Two loaders, one look:
// - ProgressDoughnut: the whole page is on its way (navigation, first visit).
//   A ring of separate segments that fill one by one, with a percentage.
// - BarsLoader: one part of a page is still coming (a chart, a list). Bars rise
//   and fall in a wave, in the chart colours, inside the area that is loading.

/* ------------------------------------------------------------------ */
/* Whole-page progress                                                 */
/* ------------------------------------------------------------------ */

const SEGMENTS = 12;
const GAP_DEG = 6;
const STORE_KEY = "horizon-load-ms";
const DEFAULT_MS = 1200;

// A browser cannot know how much of a page is left to come, so the ring follows
// how long loads have been taking on this device (remembered, averaged), and
// eases towards 95% over that time: never 100% before the page is really there.
const expectedMs = () => {
  try {
    const stored = Number(window.localStorage.getItem(STORE_KEY));
    return Number.isFinite(stored) && stored > 0 ? Math.min(Math.max(stored, 500), 8000) : DEFAULT_MS;
  } catch {
    return DEFAULT_MS; // private window or storage blocked
  }
};
const remember = (ms: number) => {
  try {
    const before = Number(window.localStorage.getItem(STORE_KEY)) || ms;
    window.localStorage.setItem(STORE_KEY, String(Math.round(before * 0.6 + ms * 0.4)));
  } catch {
    // nothing to remember into: the default is used next time
  }
};
/** Percent shown after `elapsed` ms when loads usually take `expected` ms: quick at first, easing in under 95. */
export const progressAt = (elapsed: number, expected: number) => 95 * (1 - Math.exp((-2.5 * elapsed) / expected));

const COLORS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];

/** One ring segment as an SVG arc path, between two angles (degrees, 0 = top). */
function arc(startDeg: number, endDeg: number, r: number) {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(50 + r * Math.cos(rad)).toFixed(3)} ${(50 + r * Math.sin(rad)).toFixed(3)}`;
  };
  return `M ${point(startDeg)} A ${r} ${r} 0 0 1 ${point(endDeg)}`;
}

export function ProgressDoughnut({ label }: { label?: string }) {
  const t = useT();
  const [percent, setPercent] = useState(0);
  const started = useRef(0);

  useEffect(() => {
    started.current = performance.now();
    const expected = expectedMs();
    let frame = 0;
    let last = -1;
    const tick = () => {
      const p = Math.floor(progressAt(performance.now() - started.current, expected));
      if (p !== last) {
        last = p;
        setPercent(p);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // The page has arrived when this loader goes away: that is the real duration.
    return () => {
      cancelAnimationFrame(frame);
      const took = performance.now() - started.current;
      if (took > 150) remember(took);
    };
  }, []);

  const lit = Math.round((percent / 100) * SEGMENTS);
  const step = 360 / SEGMENTS;

  return (
    <div
      role="progressbar"
      aria-label={label ?? t("common.loading")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="flex flex-col items-center gap-4"
    >
      <div className="relative size-[168px]">
        <svg viewBox="0 0 100 100" className="loader-ring size-full" aria-hidden>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <path
              key={i}
              d={arc(i * step + GAP_DEG / 2, (i + 1) * step - GAP_DEG / 2, 40)}
              fill="none"
              strokeWidth={11}
              strokeLinecap="round"
              className="transition-[stroke] duration-200"
              style={{ stroke: i < lit ? `rgb(var(${COLORS[i % COLORS.length]}))` : "rgb(var(--surface-container))" }}
            />
          ))}
        </svg>
        <span className="absolute inset-0 flex-center font-display text-24 font-semibold tabular-nums text-ink" translate="no">
          {percent}%
        </span>
      </div>
      <p className="eyebrow">{label ?? t("common.loading")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One area of a page                                                  */
/* ------------------------------------------------------------------ */

const BAR_COUNT = 7;

/**
 * Bars rising and falling in a wave, filling the area that is loading (give it
 * the height of what will appear, so nothing jumps when it does).
 */
export function BarsLoader({ className = "h-40", label }: { className?: string; label?: string }) {
  const t = useT();
  return (
    <div role="status" className={`flex w-full items-end justify-center gap-2 ${className}`}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="bars-wave block h-3/5 w-3 rounded-t-sm sm:w-4"
          style={{ backgroundColor: `rgb(var(${COLORS[i % COLORS.length]}))`, animationDelay: `${i * 110}ms` }}
        />
      ))}
      <span className="sr-only">{label ?? t("common.loading")}</span>
    </div>
  );
}
