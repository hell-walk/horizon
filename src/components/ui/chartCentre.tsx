"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/**
 * The words in the middle of a chart, shown only once the chart can draw: the
 * server sends them, but a canvas is empty until the page's script has run, and
 * on a slow phone that left a total floating over a loader for a second or two.
 */
const ChartCentre = ({ className, children }: { className: string; children: ReactNode }) => {
  // false while the server's HTML is on screen, true once the script has taken over.
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!ready) return null;
  return <div className={className}>{children}</div>;
};

export default ChartCentre;
