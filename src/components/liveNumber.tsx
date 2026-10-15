"use client";

import { useEffect, useState } from "react";

// Numbers that never sit still: an amount counts up and then keeps drifting
// like a live balance; digits keep rolling like a departures board. Only text
// changes, about 24 a second (not every frame: each one is a React render),
// so they cost little. Static for people who asked their system for less motion.

const FRAME_MS = 40;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * An amount that counts up to `value` (Indian grouping: 1,24,560.50) over
 * about 1.4 seconds, then wanders a little above and below it, for ever.
 */
export function CountUp({ value, prefix = "", duration = 1400 }: { value: number; prefix?: string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return;
    let frame = 0;
    const start = performance.now();
    // After the count-up: a new nearby target every ~2 seconds, eased to over 1.2 s.
    let from = value;
    let to = value;
    let legStart = start + duration;
    const LEG = 1200;
    const PAUSE = 900;
    let last = 0;
    const tick = (now: number) => {
      if (now - last < FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      last = now;
      if (now < start + duration) {
        setShown(value * easeOut((now - start) / duration));
      } else {
        const t = (now - legStart) / LEG;
        if (t >= 1) {
          if (now - legStart > LEG + PAUSE) {
            from = to;
            to = Math.max(0, value + (Math.random() - 0.45) * value * 0.04); // within a few percent, slightly upward
            legStart = now;
          }
          setShown(to === from ? to : from + (to - from) * easeInOut(Math.min(1, (now - legStart) / LEG)));
        } else {
          setShown(from + (to - from) * easeInOut(t));
        }
      }
      frame = requestAnimationFrame(tick);
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

/**
 * Digits that roll like a meter: they start by spinning fast and landing on
 * `value`, then each keeps ticking on at its own slow pace, for ever.
 */
export function RollingDigits({ value, duration = 1100 }: { value: string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : "0".repeat(value.length));
  useEffect(() => {
    if (reduced()) return;
    let frame = 0;
    const start = performance.now();
    const stagger = duration / (value.length + 2);
    let last = 0;
    const tick = (now: number) => {
      if (now - last < FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      last = now;
      const elapsed = now - start;
      const next = value
        .split("")
        .map((digit, i) => {
          const landAt = duration - (value.length - 1 - i) * stagger;
          if (elapsed < landAt) return String(Math.floor((elapsed / 60 + i * 3) % 10)); // the fast spin
          // Landed on its digit; from here on, one step every 1.3 to 2.2 seconds, each at its own pace.
          const period = 1300 + i * 300;
          return String((Number(digit) + Math.floor((elapsed - landAt + 400) / period)) % 10);
        })
        .join("");
      setShown((prev) => (prev === next ? prev : next));
      frame = requestAnimationFrame(tick);
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
