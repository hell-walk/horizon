// Clears the rate-limit counters in Upstash for local development and test runs.
// With Redis the limits survive a server restart (that is the point), so running
// the security suite twice within ten minutes can trip them. Refuses to run
// unless REDIS_PREFIX ends in "-dev", so it can never touch the live site's limits.
//
//   node scripts/reset-dev-limits.mjs
import { readFileSync, existsSync } from "node:fs";

import { Redis } from "@upstash/redis";

const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const prefix = env.REDIS_PREFIX || "";
if (!prefix.endsWith("-dev")) {
  console.error(`Refusing: REDIS_PREFIX is "${prefix || "(not set)"}". This only clears development limits (a prefix ending in -dev).`);
  process.exit(1);
}
if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("No Upstash settings in .env: limits are in memory, and restarting the server clears them.");
  process.exit(1);
}

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, automaticDeserialization: false });
let cursor = "0";
let removed = 0;
do {
  const [next, keys] = await redis.scan(cursor, { match: `${prefix}:rl:*`, count: 500 });
  cursor = String(next);
  if (keys.length) removed += await redis.del(...keys);
} while (cursor !== "0");
console.log(`Cleared ${removed} rate-limit counters under ${prefix}.`);
