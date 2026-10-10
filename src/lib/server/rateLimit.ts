import "server-only";

import { headers } from "next/headers";

// Fixed-window counters in memory. Per server instance, which is enough to stop
// one client hammering sign-in or the statement reader; a shared store (Redis,
// Upstash) is the upgrade once there are several instances.
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000; // a few MB at most

/** Counts one attempt for `key`; false once `limit` attempts were made within `windowMs`. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
      // Still full: drop the oldest tenth (a Map iterates in insertion order),
      // never everything, so flooding new keys cannot reset everyone's limits.
      let excess = windows.size - Math.floor(MAX_KEYS * 0.9);
      for (const k of windows.keys()) {
        if (excess-- <= 0) break;
        windows.delete(k);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

/**
 * The caller's IP. Each proxy appends the address it received the request
 * from to X-Forwarded-For, so only the entries added by our own proxies can be
 * trusted; anything to their left may have been typed by the client.
 * TRUSTED_PROXY_HOPS is how many proxies sit in front of the app (1 for Vercel,
 * Render, Railway or a single nginx).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? h.get("x-real-ip") ?? "unknown";
}

export const MINUTE = 60_000;
