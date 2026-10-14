"use client";

import { useEffect, useState } from "react";

// Numbers that arrive instead of just sitting there: an amount counts up from
// zero and settles, digits roll like a meter before stopping on their value.
// Static for people who asked their system for less motion.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/** An amount counting up to `value` (Indian grouping: 1,24,560.50) over about 1.4 seconds. */
export function CountUp({ value, prefix = "", duration = 1400 }: { value: number; prefix?: string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <span translate="no" className="tabular-nums">
      {prefix}
      {shown.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

/** Digits that roll through 0-9 and stop one after another on `value` (like a card number appearing). */
export function RollingDigits({ value, duration = 1100 }: { value: string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : "0".repeat(value.length));
  useEffect(() => {
    if (reduced()) return;
    let frame = 0;
    const start = performance.now();
    const stagger = duration / (value.length + 2);
    const tick = (now: number) => {
      const elapsed = now - start;
      let done = true;
      const next = value
        .split("")
        .map((digit, i) => {
          // Each digit keeps rolling a little longer than the one before it.
          if (elapsed >= duration - (value.length - 1 - i) * stagger) return digit;
          done = false;
          return String(Math.floor((elapsed / 60 + i * 3) % 10));
        })
        .join("");
      setShown(next);
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <span translate="no" className="tabular-nums">
      {shown}
    </span>
  );
}
