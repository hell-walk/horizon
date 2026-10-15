// Sentry in the browser. Not Next's instrumentation-client.ts on purpose:
// that file runs before the page is interactive, and Sentry's SDK was the
// heaviest script on every page. components/sentryLater.tsx imports this
// once the page is idle, so errors are still reported, just not those of
// the first second or two.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "./scrub";

Sentry.init({
  dsn: "https://75900f6fb140b7f0cd23c01019fa6f5a@o4512212505067520.ingest.de.sentry.io/4512212547207248",

  // No performance traces from browsers: errors are what matters here, and
  // tracing is a good part of the SDK's weight and work.
  tracesSampleRate: 0,

  // No session replay: recording visits would need each visitor's consent under
  // GDPR, and a finance app has no business recording screens. Errors only.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // A finance app. Sentry 11 collects cookies, headers, query strings and HTTP
  // bodies by default, which for Horizon means passwords in sign-in requests and
  // statement uploads. None of it is sent; messages are also scrubbed.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  beforeSend: (event) => scrubEvent(event),
});
