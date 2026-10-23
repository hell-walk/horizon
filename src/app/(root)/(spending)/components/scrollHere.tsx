"use client";

import { useEffect, useRef } from "react";

/**
 * Brings the panel it sits in into view when it appears (and again when `to`
 * changes): a payee's payments, picked from the pie or the list, arrive where
 * the eye is instead of somewhere the person has to go looking for.
 */
const ScrollHere = ({ to }: { to: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const panel = ref.current?.closest("section");
    panel?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [to]);
  return <span ref={ref} hidden />;
};

export default ScrollHere;
