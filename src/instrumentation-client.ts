// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "./lib/scrub";

Sentry.init({
  dsn: "https://75900f6fb140b7f0cd23c01019fa6f5a@o4512212505067520.ingest.de.sentry.io/4512212547207248",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // A finance app. Sentry 11 collects cookies, headers, query strings and HTTP
  // bodies by default, which for Horizon means passwords in sign-in requests and
  // statement uploads. None of it is sent; messages are also scrubbed.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  beforeSend: (event) => scrubEvent(event),
});

// Session Replay is the heaviest part of the Sentry SDK (~460 KB). Load it from
// Sentry's CDN after startup instead of shipping it in the initial bundle.
Sentry.lazyLoadIntegration("replayIntegration")
  .then((replayIntegration) =>
    Sentry.addIntegration(
      // Stated explicitly rather than trusting defaults: replays show the page's
      // shape, never balances, names, transactions or anything typed.
      replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        networkDetailAllowUrls: [], // no request or response bodies
      })
    )
  )
  .catch(() => {
    // Replay is optional; errors are still reported without it.
  });

// Instruments client-side navigations so Sentry can trace route transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
