// Scrubbing shared by the server logger and Sentry (browser, server, edge):
// anything that looks like a token, secret, email or account number is masked
// before it is written anywhere outside the app.

const SCRUB: [RegExp, string][] = [
  [/\b(access|public|processor|link)-(sandbox|development|production)-[0-9a-f-]+/gi, "$1-<token>"],
  [/enc:v1:[\w-]+/g, "<sealed>"],
  [/\b(secret|password|passwd|token|authorization|api[-_]?key|client[-_]?id)\b(["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, "$1$2<redacted>"],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>"],
  [/\b\d{9,18}\b/g, "<number>"], // account and card numbers
];

export function redact(text: string): string {
  return SCRUB.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

type SentryLikeEvent = {
  message?: string;
  request?: { cookies?: unknown; data?: unknown; query_string?: unknown; headers?: Record<string, string> };
  user?: { id?: string | number } & Record<string, unknown>;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  extra?: Record<string, unknown>;
};

/**
 * Sentry beforeSend: keeps the error and where it happened, drops what a
 * request carried (cookies, body, auth headers) and masks secrets in messages.
 */
export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/cookie|authorization|x-appwrite|next-action/i.test(name)) delete event.request.headers[name];
      }
    }
  }
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  if (event.message) event.message = redact(event.message);
  for (const value of event.exception?.values ?? []) if (value.value) value.value = redact(value.value);
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = redact(crumb.message);
    delete crumb.data;
  }
  delete event.extra;
  return event;
}
