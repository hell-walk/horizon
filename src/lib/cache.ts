// Small in-memory cache for upstream responses (Appwrite, Plaid).
// Keeps repeated page loads from re-fetching data that changes slowly, and
// collapses concurrent requests for the same key into one upstream call.
// Writes call invalidate() so a new bank or transfer shows up immediately.

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  short: 30_000, // bank lists, transfer rows
  minute: 60_000, // Plaid balances and transactions
  day: 86_400_000, // Plaid institution details, effectively static
};

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
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
}
