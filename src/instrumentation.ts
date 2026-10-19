import type { Instrumentation } from "next";

// Sentry's server SDK takes most of a second to load, which was most of every
// cold start. So it is not loaded when the server starts: only the first time
// a request fails, and then kept. Errors still reach Sentry; server-side
// performance traces do not (the browser SDK is separate and unchanged).
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  await import("../sentry.server.config"); // runs Sentry.init once
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
  await Sentry.flush(2000);
};
