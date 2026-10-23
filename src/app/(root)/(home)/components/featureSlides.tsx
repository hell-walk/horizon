"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, FileUp, Lock, PlugZap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A slide opens one page (`href`), or, the welcome slide, offers the two
 * things to do first (`actions`). `chip` is the small label above the title
 * (the number, or the welcome slide's eyebrow); `wordmark` puts the big
 * "Horizon" above the title and `note` the trust line beneath the buttons,
 * both only on wide screens.
 */
export type FeatureSlide = {
  n: string;
  chip: string;
  title: string;
  body: string;
  href?: string;
  actions?: { href: string; label: string; kind: "connect" | "upload" }[];
  wordmark?: string;
  note?: string;
};

const EVERY_MS = 6000;

/**
 * A slideshow under the greeting: what Horizon is (the landing page's top,
 * with "connect a bank" and "upload a statement"), then what it can do, one
 * feature at a time, each opening its page. On a laptop each slide is laid
 * out like the landing hero, centred and large; on a phone it is a compact
 * left-aligned card. Moves on by itself every few seconds, waits while the
 * pointer or focus is on it, and can be stepped by hand. It is always
 * there: nothing to close.
 */
const FeatureSlides = ({ slides, labels }: { slides: FeatureSlide[]; labels: { heading: string; open: string; prev: string; next: string } }) => {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (held || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setAt((i) => (i + 1) % count), EVERY_MS);
    return () => window.clearInterval(timer);
  }, [held, count]);

  if (count === 0) return null;
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
              className="flex w-full shrink-0 flex-col justify-center px-4 py-3 sm:px-6 sm:py-5"
              aria-hidden={i !== at}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:items-center sm:gap-2.5 sm:text-center">
                <span className={cn("chip w-fit rounded-full", s.wordmark ? "h-auto max-w-full whitespace-normal py-1 sm:text-center" : "chip-lime")}>
                  {s.wordmark && <span className="dot shrink-0 bg-lime" />}
                  {s.chip}
                </span>
                {s.wordmark && (
                  <p className="hidden font-display text-[clamp(36px,6vw,64px)] font-bold uppercase leading-[0.9] tracking-tighter text-ink sm:block">
                    {s.wordmark}
                  </p>
                )}
                <p
                  className={cn(
                    "font-display font-semibold uppercase tracking-tight text-ink",
                    s.wordmark ? "text-18 sm:text-20" : "text-18 sm:text-28 sm:leading-none",
                  )}
                >
                  {s.title}
                </p>
                <p className="max-w-xl text-13 text-ink-muted sm:text-14">{s.body}</p>
                {s.actions ? (
                  <span className="flex flex-wrap gap-2 sm:justify-center sm:gap-3 sm:pt-1">
                    {s.actions.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        tabIndex={i === at ? 0 : -1}
                        className={cn("btn-sm w-fit shrink-0 rounded-full sm:px-5", a.kind === "connect" ? "btn-accent" : "btn-secondary")}
                      >
                        {a.kind === "connect" ? <PlugZap className="size-4" aria-hidden /> : <FileUp className="size-4" aria-hidden />} {a.label}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <Link href={s.href ?? "/"} tabIndex={i === at ? 0 : -1} className="btn-secondary btn-sm w-fit shrink-0 rounded-full sm:mt-1 sm:px-5">
                    {labels.open} <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                )}
                {s.note && (
                  <p className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint sm:flex">
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                    {s.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-center gap-1 pb-2" role="tablist">
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
