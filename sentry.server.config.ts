// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://75900f6fb140b7f0cd23c01019fa6f5a@o4512212505067520.ingest.de.sentry.io/4512212547207248",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
