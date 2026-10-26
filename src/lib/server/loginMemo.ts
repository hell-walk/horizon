import "server-only";

import type { getUserInfo } from "./banks";
import type { SessionUser } from "./auth";

// What auth.ts remembers about a login for a minute, in this server copy's
// memory: the session per access token, and the profile row per login. Kept
// here, apart from auth.ts, so that the code which changes a login (plan,
// codes, profile, sign-out, deletion) can drop it without importing auth.ts.
// Nothing is remembered under test: each test is its own world.
export const MEMO_MS = process.env.NODE_ENV === "test" ? 0 : 60_000;
export const sessions = new Map<string, { value: SessionUser | null; expires: number }>();
export const profiles = new Map<string, { value: Awaited<ReturnType<typeof getUserInfo>>; expires: number }>();

/**
 * Drops everything remembered about one login, on every device it is signed in
 * on: after its subscription, profile, language or password changes, a sign-out,
 * or deletion, so the next page asks Supabase again instead of showing the old
 * state for up to a minute. Other server copies still forget on their own clock.
 */
export function forgetLogin(loginId: string) {
  for (const [key, kept] of sessions) if (kept.value?.id === loginId) sessions.delete(key);
  profiles.delete(loginId);
}
