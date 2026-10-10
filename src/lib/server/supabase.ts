import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { isSessionCookie, safeCookie, SESSION_COOKIE_OPTIONS } from "../sessionCookie";

// Supabase handles sign-in only: who you are. Everything else (profile, banks,
// statements, settings) stays in Appwrite, found by the Supabase user id.
//
// Both keys stay on the server. The browser never talks to Supabase: it only
// carries the session cookie, which scripts on the page cannot read.

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const config = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase is not configured (SUPABASE_URL, SUPABASE_ANON_KEY)");
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
};

/**
 * The signed-in person's Supabase client, reading and writing the session
 * cookie. Pages cannot write cookies, only actions and route handlers can; a
 * refreshed session read during a page render is saved by the proxy instead.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = config();
  const jar = await cookies();
  return createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, safeCookie(options));
        } catch {
          // Called from a page render: the proxy has already refreshed the session.
        }
      },
    },
  });
}

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** Full access (service role): creating, deleting and signing out users. Never tied to a request's cookies. */
export function createSupabaseAdmin() {
  const { url } = config();
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase is not configured (SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, SUPABASE_SERVICE_ROLE_KEY, { auth: noSession });
}

/** A client with no cookies, for checking a password without touching the browser's session. */
export function createSupabaseStateless() {
  const { url, anonKey } = config();
  return createClient(url, anonKey, { auth: noSession });
}

/**
 * Is this the password of this account? Signs in once on the side and ends
 * that extra session straight away, so the check leaves nothing behind.
 */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const { data, error } = await createSupabaseStateless().auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await createSupabaseAdmin()
    .auth.admin.signOut(data.session.access_token, "local")
    .catch(() => {});
  return true;
}

/** Removes the session cookie (all of its pieces) from the browser. */
export async function clearSessionCookies() {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (isSessionCookie(name)) jar.delete(name);
  }
}
