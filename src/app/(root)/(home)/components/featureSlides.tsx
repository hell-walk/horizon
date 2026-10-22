"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, FileUp, PlugZap, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** A slide opens one page (`href`), or, the welcome slide, offers the two things to do first (`actions`). */
export type FeatureSlide = { n: string; title: string; body: string; href?: string; actions?: { href: string; label: string; kind: "connect" | "upload" }[] };
export const TOUR_HIDDEN_COOKIE = "horizon-tour-hidden";

const EVERY_MS = 6000;

/**
 * A small slideshow under the greeting: what Horizon is (the landing page's
 * top, made small, with "connect a bank" and "upload a statement"), then what
 * it can do, one feature at a time, each opening its page. Moves on by itself every few seconds, waits
 * while the pointer or focus is on it, and can be stepped by hand. The X
 * hides it for a month (a cookie the server reads).
 */
const FeatureSlides = ({ slides, labels }: { slides: FeatureSlide[]; labels: { heading: string; open: string; hide: string; prev: string; next: string } }) => {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [gone, setGone] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (held || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setAt((i) => (i + 1) % count), EVERY_MS);
    return () => window.clearInterval(timer);
  }, [held, count]);

  if (gone || count === 0) return null;
  const step = (dir: 1 | -1) => setAt((i) => (i + dir + count) % count);

  return (
    <section
      // Softer than the other panels: round corners, pill buttons (a welcome, not a ledger).
      className="relative overflow-hidden rounded-2xl border border-line bg-card"
      aria-roledescription="carousel"
      aria-label={labels.heading}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <header className="panel-head">
        <span className="eyebrow">{labels.heading}</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label={labels.prev} className="btn-ghost btn-sm rounded-full">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={labels.next} className="btn-ghost btn-sm rounded-full">
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              document.cookie = `${TOUR_HIDDEN_COOKIE}=1; path=/; max-age=${30 * 86400}; samesite=lax`;
              setGone(true);
            }}
            aria-label={labels.hide}
            className="btn-ghost btn-sm rounded-full"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </header>

      {/* The slides side by side on one track; the track slides to the current one. */}
      <div className="overflow-hidden">
        <ul
          className="flex transition-transform duration-500 motion-reduce:transition-none"
          style={{ transform: `translateX(-${at * 100}%)`, transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          aria-live="polite"
        >
          {slides.map((s, i) => (
            <li
              key={s.n}
              className="w-full shrink-0 px-4 py-4"
              aria-hidden={i !== at}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="chip chip-lime w-fit rounded-full">{s.n}</span>
                  <p className="font-display text-18 font-semibold uppercase tracking-tight text-ink">{s.title}</p>
                  <p className="text-13 text-ink-muted">{s.body}</p>
                </div>
                {s.actions ? (
                  <span className="flex flex-wrap gap-2">
                    {s.actions.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        tabIndex={i === at ? 0 : -1}
                        className={cn("btn-sm w-fit shrink-0 rounded-full", a.kind === "connect" ? "btn-accent" : "btn-secondary")}
                      >
                        {a.kind === "connect" ? <PlugZap className="size-3.5" aria-hidden /> : <FileUp className="size-3.5" aria-hidden />} {a.label}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <Link href={s.href ?? "/"} tabIndex={i === at ? 0 : -1} className="btn-secondary btn-sm w-fit shrink-0 rounded-full">
                    {labels.open} <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-center gap-1 pb-3" role="tablist">
        {slides.map((s, i) => (
          <button
            key={s.n}
            type="button"
            role="tab"
            aria-selected={i === at}
            aria-label={s.title}
            onClick={() => setAt(i)}
            className="group flex h-5 min-w-5 items-center justify-center"
          >
            <span className={cn("h-1.5 rounded-full transition-all duration-300", i === at ? "w-5 bg-lime" : "w-1.5 bg-line group-hover:bg-ink-faint")} />
          </button>
        ))}
      </div>
    </section>
  );
};

export default FeatureSlides;
