import "server-only";

import { headers } from "next/headers";

// Fixed-window counters in memory. Per server instance, which is enough to stop
// one client hammering sign-in or the statement reader; a shared store (Redis,
// Upstash) is the upgrade once there are several instances.
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

/** Counts one attempt for `key`; false once `limit` attempts were made within `windowMs`. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
      if (windows.size >= MAX_KEYS) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

/** The caller's IP as reported by the proxy in front of the app. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export const MINUTE = 60_000;
