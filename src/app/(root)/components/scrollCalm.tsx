"use client";

import { useEffect } from "react";

// While a page scrolls, the content slides under a mouse pointer that is not
// moving, and every row, card and chart it crosses reacts as if hovered: rows
// flash, charts grow, Chart.js redraws and pops tooltips. That made scrolling
// past the charts feel jittery. During a scroll (and 150 ms after) hover
// effects are switched off (globals.css: html[data-scrolling]); clicks and
// keyboard use are not affected once the scroll stops.

const SETTLE_MS = 150;

const ScrollCalm = () => {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;
    const onScroll = () => {
      if (timer === undefined) root.setAttribute("data-scrolling", "");
      else window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        root.removeAttribute("data-scrolling");
        timer = undefined;
      }, SETTLE_MS);
    };
    // Scroll events do not bubble; capturing catches every page's own scroller.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(timer);
      root.removeAttribute("data-scrolling");
    };
  }, []);
  return null;
};

export default ScrollCalm;
