"use client";

import { ChevronLeft, ChevronRight, Pointer, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { isTourId, stepIsOn, TOUR_DONE_COOKIE, TOUR_EVENT, TOUR_STORAGE, TOURS } from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };
type Words = Record<string, string>;

const PAD = 8;
const CARD_W = 340;
const FIND_FOR_MS = 6000;

/** The tour in progress, kept across pages in sessionStorage. */
const readState = (): { id: string; step: number } | null => {
  try {
    const raw = sessionStorage.getItem(TOUR_STORAGE);
    const v = raw ? (JSON.parse(raw) as { id?: unknown; step?: unknown }) : null;
    return v && isTourId(v.id) && typeof v.step === "number" ? { id: v.id, step: v.step } : null;
  } catch {
    return null;
  }
};
const writeState = (state: { id: string; step: number } | null) => {
  try {
    if (state) sessionStorage.setItem(TOUR_STORAGE, JSON.stringify(state));
    else sessionStorage.removeItem(TOUR_STORAGE);
  } catch {
    /* private mode: the tour just does not survive a page change */
  }
};
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};
const findTarget = (selectors: string[] | undefined) => {
  for (const s of selectors ?? []) for (const el of document.querySelectorAll(s)) if (visible(el)) return el;
  return null;
};

/**
 * The guided tour: dims the page, cuts a window around one thing and says
 * what it is, step by step, across pages. A step on another page sends the
 * person there and carries on. Phones get the card as a sheet at the bottom
 * and, on the first card, a hand that shows scrolling and swiping. Mounted
 * once in the app shell; idle until a tour is started (components/tour/tourStart).
 */
const TourGuide = ({ words }: { words: Words }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ id: string; step: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [looking, setLooking] = useState(false);
  const targetRef = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Pick up a tour: on mount, when the page changes, and when a button starts one.
  useEffect(() => {
    const sync = () => setState(readState());
    const first = window.setTimeout(sync, 0);
    window.addEventListener(TOUR_EVENT, sync);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener(TOUR_EVENT, sync);
    };
  }, [pathname]);

  const steps = state ? TOURS[state.id] : null;
  const step = steps && state ? steps[state.step] : null;
  const onThisPage = step ? stepIsOn(step, pathname) : false;

  const finish = useCallback(() => {
    writeState(null);
    document.cookie = `${TOUR_DONE_COOKIE}=1; path=/; max-age=${365 * 86400}; samesite=lax`;
    setState(null);
    setRect(null);
    targetRef.current = null;
  }, []);

  const go = useCallback(
    (to: number) => {
      if (!state || !steps) return;
      if (to < 0) return;
      if (to >= steps.length) return finish();
      const next = { id: state.id, step: to };
      writeState(next);
      setRect(null);
      targetRef.current = null;
      setState(next);
      if (!stepIsOn(steps[to], pathname)) router.push(steps[to].page);
    },
    [state, steps, pathname, router, finish],
  );

  // A step on another page: go there (the state is already in storage, so the guide picks it up after the move).
  useEffect(() => {
    if (step && !onThisPage) router.push(step.page);
  }, [step, onThisPage, router]);

  // Find the thing to point at (pages stream in, so keep looking for a while), scroll it into view, measure it.
  useEffect(() => {
    if (!step || !onThisPage || !step.target) return;
    let stopped = false;
    const started = Date.now();
    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const tick = () => {
      if (stopped) return;
      const el = findTarget(step.target);
      if (el) {
        targetRef.current = el;
        setLooking(false);
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        window.setTimeout(measure, 450);
        window.setTimeout(measure, 900);
      } else if (Date.now() - started < FIND_FOR_MS) window.setTimeout(tick, 200);
      else setLooking(false);
    };
    // Off the effect's own tick, as React asks of state changes in effects.
    const first = window.setTimeout(() => {
      setLooking(true);
      tick();
    }, 0);
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      stopped = true;
      window.clearTimeout(first);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [step, onThisPage]);

  // Keys, and focus on the card.
  useEffect(() => {
    if (!step || !onThisPage) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") go((state?.step ?? 0) + 1);
      else if (e.key === "ArrowLeft") go((state?.step ?? 0) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onThisPage, go, finish, state?.step]);

  if (!state || !steps || !step || !onThisPage) return null;
  const n = state.step + 1;
  const total = steps.length;
  const last = n === total;
  const spot = rect && step.target ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;

  // Where the card goes on a wide screen: under the thing if there is room, else above; on phones, a sheet at the bottom.
  const wide = typeof window !== "undefined" && window.innerWidth >= 640;
  let cardStyle: React.CSSProperties | undefined;
  let arrow: "up" | "down" | null = null;
  if (wide && spot) {
    const below = spot.top + spot.height + 16;
    const fitsBelow = below + 240 < window.innerHeight;
    const left = Math.min(Math.max(16, spot.left), window.innerWidth - CARD_W - 16);
    cardStyle = fitsBelow ? { top: below, left, width: CARD_W } : { bottom: window.innerHeight - spot.top + 16, left, width: CARD_W };
    arrow = fitsBelow ? "up" : "down";
  } else if (wide) {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: CARD_W + 40 };
  }

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={words[`${step.key}Title`]}>
      {/* The dimmed page, with a window cut around the target (one box shadow does the dimming). */}
      {spot ? (
        <div
          className="tour-spot pointer-events-none absolute rounded-lg ring-2 ring-lime transition-all duration-300"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/62" />
      )}
      <button type="button" className="absolute inset-0 cursor-default" aria-label={words.skip} onClick={finish} tabIndex={-1} />

      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className={cn(
          "tour-card fixed flex flex-col gap-3 border border-line bg-card p-4 text-ink shadow-xl outline-hidden",
          wide ? "rounded-xl" : "inset-x-0 bottom-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {arrow && (
          <span
            aria-hidden
            className={cn("absolute size-4 rotate-45 border-line bg-card", arrow === "up" ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r")}
            style={{ left: spot ? Math.min(Math.max(16, spot.left + spot.width / 2 - (cardStyle?.left as number) - 8), CARD_W - 32) : 24 }}
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow">{words.stepOf.replace("{n}", String(n)).replace("{total}", String(total))}</span>
          <button type="button" onClick={finish} className="btn-ghost btn-sm -mr-2 -mt-1 rounded-full" aria-label={words.skip}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {step.intro && (
          <div className="tour-hands sm:hidden" aria-hidden>
            <Pointer className="tour-hand tour-hand-scroll size-7 text-lime" />
            <Pointer className="tour-hand tour-hand-swipe size-7 text-lime" />
          </div>
        )}
        <p className="font-display text-18 font-semibold uppercase tracking-tight">{words[`${step.key}Title`]}</p>
        <p className="text-14 text-ink-muted">{words[`${step.key}Body`]}</p>
        {step.intro && <p className="text-12 text-ink-faint sm:hidden">{words.hint}</p>}
        {looking && !rect && step.target && <p className="text-12 text-ink-faint">…</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={finish} className="btn-ghost btn-sm">
            {words.skip}
          </button>
          <span className="flex items-center gap-2">
            {state.step > 0 && (
              <button type="button" onClick={() => go(state.step - 1)} className="btn-secondary btn-sm">
                <ChevronLeft className="size-4" aria-hidden /> {words.back}
              </button>
            )}
            <button type="button" onClick={() => go(state.step + 1)} className="btn-accent btn-sm">
              {last ? words.done : words.next} {!last && <ChevronRight className="size-4" aria-hidden />}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TourGuide;
