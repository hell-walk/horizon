// Small in-memory cache for upstream responses (Appwrite, Plaid).
// Keeps repeated page loads from re-fetching data that changes slowly, and
// collapses concurrent requests for the same key into one upstream call.
// Writes call invalidate() so a new bank or transfer shows up immediately.
//
// On hosts that run several copies of the server at once (Vercel, or any
// host with MULTI_INSTANCE=1), a copy cannot see another copy's invalidate():
// after a user imports a statement on one copy, another could show the old
// list for the length of its cache. There, data that belongs to one user is
// kept only for the length of one request (still loaded once per page), while
// outside data (Plaid, Setu, exchange rates) keeps its normal cache.

import { cache as perRequest } from "react";

type Entry = { value: unknown; expires: number };

const MULTI_INSTANCE = process.env.VERCEL === "1" || process.env.MULTI_INSTANCE === "1";
const USER_DATA = ["banks:", "statement:", "transfers:", "corrections:", "goals:"];
const perUser = (key: string) => MULTI_INSTANCE && USER_DATA.some((prefix) => key.startsWith(prefix));
// One map per request (React gives each server request its own); a fresh map outside a request.
const requestStore = perRequest(() => new Map<string, Promise<unknown>>());

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  short: 30_000, // bank lists, transfer rows
  minute: 60_000, // Plaid balances and transactions
  day: 86_400_000, // Plaid institution details, effectively static
};

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  if (perUser(key)) {
    const here = requestStore();
    const seen = here.get(key);
    if (seen) return seen as Promise<T>;
    const request = fetcher();
    here.set(key, request);
    request.catch(() => here.delete(key)); // a failure is not remembered
    return request;
  }

  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const request = fetcher()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  if (MULTI_INSTANCE) {
    const here = requestStore();
    for (const key of here.keys()) if (key.startsWith(prefix)) here.delete(key);
  }
}

/** Stores a value the app just wrote, so the next read does not depend on the upstream catching up. */
export function remember(key: string, value: unknown, ttlMs: number) {
  // The page drawn after a change, in the same request, must see the change.
  if (perUser(key)) requestStore().set(key, Promise.resolve(value));
  else store.set(key, { value, expires: Date.now() + ttlMs });
}
