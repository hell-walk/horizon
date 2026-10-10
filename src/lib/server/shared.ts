import "server-only";

import { redisKey, tryRedis } from "./redis";

// Small pieces of state every server instance must agree on: "this is being
// done right now" (a lock) and "this was done, here is the answer" (a short
// memory). In Redis when configured, else in this instance's memory.

const locks = new Map<string, number>(); // key -> expires at
const values = new Map<string, { value: string; expires: number }>();

const sweep = () => {
  const now = Date.now();
  for (const [k, until] of locks) if (until <= now) locks.delete(k);
  for (const [k, v] of values) if (v.expires <= now) values.delete(k);
};

/** Takes the lock for `key` for `ms`; false if someone already holds it. */
export async function claim(kind: string, key: string, ms: number): Promise<boolean> {
  const shared = await tryRedis((r) => r.set(redisKey(kind, key), "1", { nx: true, px: ms }));
  if (shared !== undefined) return shared === "OK";
  sweep();
  if (locks.has(`${kind}:${key}`)) return false;
  locks.set(`${kind}:${key}`, Date.now() + ms);
  return true;
}

export async function release(kind: string, key: string) {
  const done = await tryRedis((r) => r.del(redisKey(kind, key)));
  if (done === undefined) locks.delete(`${kind}:${key}`);
}

/** Remembers a JSON value for `ms`. */
export async function put(kind: string, key: string, value: unknown, ms: number) {
  const json = JSON.stringify(value);
  const done = await tryRedis((r) => r.set(redisKey(kind, key), json, { px: ms }));
  if (done === undefined) {
    sweep();
    values.set(`${kind}:${key}`, { value: json, expires: Date.now() + ms });
  }
}

/** Forgets a remembered value (everywhere, when Redis is configured). */
export async function forget(kind: string, key: string) {
  const done = await tryRedis((r) => r.del(redisKey(kind, key)));
  if (done === undefined) values.delete(`${kind}:${key}`);
}

export async function get<T>(kind: string, key: string): Promise<T | null> {
  const shared = await tryRedis((r) => r.get<string>(redisKey(kind, key)));
  const raw = shared !== undefined ? shared : (values.get(`${kind}:${key}`)?.expires ?? 0) > Date.now() ? values.get(`${kind}:${key}`)!.value : null;
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
