// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "./src/lib/scrub";

Sentry.init({
  dsn: "https://75900f6fb140b7f0cd23c01019fa6f5a@o4512212505067520.ingest.de.sentry.io/4512212547207248",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // A finance app. Sentry 11 collects cookies, headers, query strings and HTTP
  // bodies by default, which for Horizon means passwords in sign-in requests and
  // statement uploads. None of it is sent; messages are also scrubbed.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  beforeSend: (event) => scrubEvent(event),
});
