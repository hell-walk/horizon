"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { stepIsOn, TOUR_EVENT, TOUR_STORAGE, TOURS } from "@/lib/tour";

/** Starts a tour: "Take the tour" on About, "Demo" on each of its boxes. Goes to the first step's page when it is elsewhere. */
const TourStart = ({ id, className, children }: { id: keyof typeof TOURS; className?: string; children: ReactNode }) => {
  const router = useRouter();
  const start = () => {
    try {
      sessionStorage.setItem(TOUR_STORAGE, JSON.stringify({ id, step: 0 }));
    } catch {
      /* no storage: the tour runs on this page only */
    }
    const first = TOURS[id][0];
    if (stepIsOn(first, window.location.pathname)) window.dispatchEvent(new Event(TOUR_EVENT));
    else router.push(first.page);
  };
  return (
    <button type="button" onClick={start} className={className}>
      {children}
    </button>
  );
};

export default TourStart;
