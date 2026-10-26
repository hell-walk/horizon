"use client";

import { useEffect } from "react";

// Starts Sentry's browser SDK once the page is idle (or after a few seconds),
// off the critical path: it was the heaviest script on every page, and it
// has no part in showing the page.
export default function SentryLater() {
  useEffect(() => {
    const start = () => {
      import("@/lib/browser/sentryClient").catch(() => {}); // an ad blocker may refuse it; the page is unaffected
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(start, 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
