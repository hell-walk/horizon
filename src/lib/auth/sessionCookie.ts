import type { CookieOptions } from "@supabase/ssr";

// The sign-in cookie's rules, shared by the server code (server/supabase.ts)
// and the proxy that keeps sessions fresh (src/proxy.ts). No secrets here.

/** The session cookie's name. Long sessions are split into SESSION_COOKIE.0, .1... */
export const SESSION_COOKIE = "horizon-session";

const MAX_SESSION_DAYS = 30;

// Not readable by scripts, sent only to this site, HTTPS-only in production
// (local development over plain HTTP, e.g. a phone on the same Wi-Fi, would
// otherwise lose it). "lax" rather than "strict": coming back from Google is a
// navigation from another site, and the sign-in has to survive it. Lasts 30
// days after the last visit.
export const SESSION_COOKIE_OPTIONS: CookieOptions & { name: string } = {
  name: SESSION_COOKIE,
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: MAX_SESSION_DAYS * 24 * 60 * 60,
};

/** Supabase's own cookie options, made to keep the rules above. Removal (age 0) still works. */
export const safeCookie = (options: CookieOptions): CookieOptions => {
  const { name: _name, ...rules } = SESSION_COOKIE_OPTIONS;
  return { ...options, ...rules, maxAge: Math.min(options.maxAge ?? rules.maxAge!, rules.maxAge!) };
};

/** Is this one of the session cookie's pieces (or Supabase's sign-in-with-Google helper cookie)? */
export const isSessionCookie = (name: string) => name === SESSION_COOKIE || name.startsWith(`${SESSION_COOKIE}.`) || name.startsWith(`${SESSION_COOKIE}-`);
