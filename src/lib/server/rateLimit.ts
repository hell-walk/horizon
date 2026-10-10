import "server-only";

import { headers } from "next/headers";

import { redisKey, tryRedis } from "./redis";

// Fixed-window counters. With Upstash configured they live in Redis, shared by
// every server instance; otherwise (and for any call where Redis cannot be
// reached) in this instance's memory, which still stops one client hammering
// sign-in or the statement reader.

const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000; // a few MB at most

// Counts one attempt and starts the window on the first, in one step: a crash
// between the two can never leave a key without an expiry (a lockout forever).
const COUNT = `local c = redis.call('INCR', KEYS[1])
if c == 1 or redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return c`;

function countInMemory(key: string, windowMs: number): number {
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
    return 1;
  }
  return ++entry.count;
}

async function count(key: string, windowMs: number): Promise<number> {
  const shared = await tryRedis((r) => r.eval<[string], number>(COUNT, [redisKey("rl", key)], [String(windowMs)]));
  return typeof shared === "number" ? shared : countInMemory(key, windowMs);
}

/** Counts one attempt for `key`; false once `limit` attempts were made within `windowMs`. */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await count(key, windowMs)) <= limit;
}

/** True once `limit` events were recorded for `key` in the current window (records nothing). */
export async function isBlocked(key: string, limit: number): Promise<boolean> {
  const shared = await tryRedis((r) => r.get<string>(redisKey("rl", key)));
  if (shared !== undefined) return Number(shared ?? 0) >= limit;
  const entry = windows.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= limit);
}

/** Records one event (e.g. a failed password) without asking whether it is allowed. */
export async function record(key: string, windowMs: number) {
  await count(key, windowMs);
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
