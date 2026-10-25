"use client";

import { useEffect } from "react";

import { TOUR_DONE_COOKIE, TOUR_EVENT, TOUR_STORAGE } from "@/lib/tour";

/**
 * Starts the Home tour once, for someone new: Home renders this when their
 * first statement is in and the tour has not run before (a cookie the server
 * reads). It marks the tour as seen straight away, so a refresh does not
 * start it again; the tour itself carries on from sessionStorage.
 */
const TourAutoStart = () => {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(TOUR_STORAGE)) return;
      sessionStorage.setItem(TOUR_STORAGE, JSON.stringify({ id: "home", step: 0 }));
    } catch {
      return;
    }
    document.cookie = `${TOUR_DONE_COOKIE}=1; path=/; max-age=${365 * 86400}; samesite=lax`;
    window.dispatchEvent(new Event(TOUR_EVENT));
  }, []);
  return null;
};

export default TourAutoStart;
