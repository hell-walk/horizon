import "server-only";

import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import { logError } from "./log";

// Upstash Redis, shared by every server instance: rate limits, the transfer
// double-send guard, and small caches that must agree across instances.
// Optional: without UPSTASH_REDIS_REST_URL and _TOKEN (local development, the
// tests) everything falls back to memory, as before. If Redis cannot be
// reached for a moment, callers fall back to memory for that call too.
//
// Keys are hashed before they leave the server, so email addresses, IPs and
// ids never sit in a third-party store; only Horizon can tell what a key is.

let client: Redis | null | undefined;

export function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;
  return client;
}

/** For tests: use this client (or none) instead of the one from the environment. */
export function setRedisForTests(next: Redis | null | undefined) {
  client = next;
}

const PREFIX = () => process.env.REDIS_PREFIX || "horizon";

/** "rl:<sha256 of the key>": what a key means stays on our side. */
export const redisKey = (kind: string, key: string) =>
  `${PREFIX()}:${kind}:${createHash("sha256").update(key).digest("base64url").slice(0, 32)}`;

/** Runs a Redis call, or returns undefined (and logs once a minute) when Redis is not there or fails. */
let lastLogged = 0;
export async function tryRedis<T>(run: (r: Redis) => Promise<T>): Promise<T | undefined> {
  const r = redis();
  if (!r) return undefined;
  try {
    return await run(r);
  } catch (error) {
    if (Date.now() - lastLogged > 60_000) {
      lastLogged = Date.now();
      logError("redis: unavailable, using memory", error);
    }
    return undefined;
  }
}
