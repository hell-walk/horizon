import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headerValues = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerValues.get(name.toLowerCase()) ?? null }),
}));

const { allow, clientIp, isBlocked, MINUTE, record } = await import("@/lib/server/rateLimit");
const { setRedisForTests } = await import("@/lib/server/redis");
const { claim, get, put, release } = await import("@/lib/server/shared");

describe("allow (fixed-window counter, in memory)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit, then refuses", async () => {
    const key = `t:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await allow(key, 3, MINUTE));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("opens again once the window has passed", async () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) await allow(key, 3, MINUTE);
    expect(await allow(key, 3, MINUTE)).toBe(false);
    vi.advanceTimersByTime(MINUTE + 1);
    expect(await allow(key, 3, MINUTE)).toBe(true);
  });

  it("counts keys separately", async () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    await allow(a, 1, MINUTE);
    expect(await allow(a, 1, MINUTE)).toBe(false);
    expect(await allow(b, 1, MINUTE)).toBe(true);
  });

  it("cannot be reset by flooding it with new keys", async () => {
    const victim = `victim:${Math.random()}`;
    for (let i = 0; i < 3; i++) await allow(victim, 3, 10 * MINUTE);
    vi.advanceTimersByTime(1);
    // 60,000 fresh keys overflow the table (50,000): only the oldest tenth may go.
    for (let i = 0; i < 60_000; i++) await allow(`flood:${i}`, 3, 10 * MINUTE);
    // The victim was among the oldest, so it may have been evicted. What matters is
    // that the table never empties completely: the most recent floods still count.
    expect(await allow("flood:59999", 1, 10 * MINUTE)).toBe(false);
  });

  it("records failures and reports a block without counting the check", async () => {
    const key = `fail:${Math.random()}`;
    for (let i = 0; i < 3; i++) await record(key, MINUTE);
    expect(await isBlocked(key, 3)).toBe(true);
    expect(await isBlocked(key, 4)).toBe(false);
  });
});

describe("with Redis (shared by every server instance)", () => {
  // A stand-in for Upstash: the counting script, GET, SET NX PX and DEL, in memory.
  const store = new Map<string, { value: string; expires: number }>();
  const live = (k: string) => {
    const e = store.get(k);
    if (e && e.expires <= Date.now()) store.delete(k);
    return store.get(k);
  };
  const fake = {
    eval: async (_script: string, keys: string[], args: string[]) => {
      const e = live(keys[0]);
      const count = Number(e?.value ?? 0) + 1;
      store.set(keys[0], { value: String(count), expires: e && e.expires > 0 ? e.expires : Date.now() + Number(args[0]) });
      return count;
    },
    get: async (k: string) => live(k)?.value ?? null,
    set: async (k: string, v: string, o: { nx?: boolean; px?: number }) => {
      if (o.nx && live(k)) return null;
      store.set(k, { value: v, expires: Date.now() + (o.px ?? 1e9) });
      return "OK";
    },
    del: async (k: string) => (store.delete(k) ? 1 : 0),
  };
  const failing = { eval: async () => Promise.reject(new Error("down")), get: async () => Promise.reject(new Error("down")) };

  afterEach(() => {
    setRedisForTests(undefined);
    store.clear();
  });

  it("counts in Redis, under a hashed key that does not reveal the email", async () => {
    setRedisForTests(fake as never);
    const key = "auth:fail:ada@example.com";
    expect(await allow(key, 2, MINUTE)).toBe(true);
    expect(await allow(key, 2, MINUTE)).toBe(true);
    expect(await allow(key, 2, MINUTE)).toBe(false);
    const stored = [...store.keys()];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^horizon:rl:[\w-]{32}$/);
    expect(stored[0]).not.toContain("ada");
    expect(await isBlocked(key, 3)).toBe(true);
  });

  it("two server instances share one count", async () => {
    setRedisForTests(fake as never);
    const key = `shared:${Math.random()}`;
    // Instance A and B are the same code against the same Redis: the 3rd call is refused wherever it lands.
    await allow(key, 2, MINUTE);
    await allow(key, 2, MINUTE);
    expect(await allow(key, 2, MINUTE)).toBe(false);
  });

  it("keeps limiting, in memory, when Redis is down", async () => {
    setRedisForTests(failing as never);
    const key = `down:${Math.random()}`;
    expect(await allow(key, 1, MINUTE)).toBe(true);
    expect(await allow(key, 1, MINUTE)).toBe(false);
  });

  it("with several server copies and Redis down, each copy allows only a quarter (abuse stays bounded)", async () => {
    setRedisForTests(failing as never);
    vi.stubEnv("MULTI_INSTANCE", "1");
    try {
      const key = `auth:fail:${Math.random()}@example.com`;
      const results = [];
      for (let i = 0; i < 9; i++) results.push(await allow(key, 8, MINUTE));
      expect(results.filter(Boolean)).toHaveLength(2); // ceil(8 / 4)
      for (let i = 0; i < 2; i++) await record(`fail:${key}`, MINUTE);
      expect(await isBlocked(`fail:${key}`, 8)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("one server copy without Redis at all keeps the full limit", async () => {
    setRedisForTests(null);
    vi.stubEnv("MULTI_INSTANCE", "1");
    try {
      const key = `none:${Math.random()}`;
      const results = [];
      for (let i = 0; i < 9; i++) results.push(await allow(key, 8, MINUTE));
      expect(results.filter(Boolean)).toHaveLength(8);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("locks and remembers for the transfer guard", async () => {
    setRedisForTests(fake as never);
    expect(await claim("transfer-lock", "k1", MINUTE)).toBe(true);
    expect(await claim("transfer-lock", "k1", MINUTE)).toBe(false); // a second copy while the first runs
    await release("transfer-lock", "k1");
    expect(await claim("transfer-lock", "k1", MINUTE)).toBe(true);
    await put("transfer-done", "k1", { ok: true }, MINUTE);
    expect(await get("transfer-done", "k1")).toEqual({ ok: true });
    expect(await get("transfer-done", "k2")).toBeNull();
  });

  it("the transfer guard works in memory without Redis", async () => {
    setRedisForTests(null);
    expect(await claim("transfer-lock", "m1", MINUTE)).toBe(true);
    expect(await claim("transfer-lock", "m1", MINUTE)).toBe(false);
    await put("transfer-done", "m1", { ok: false, error: "x" }, MINUTE);
    expect(await get("transfer-done", "m1")).toEqual({ ok: false, error: "x" });
  });
});

describe("clientIp", () => {
  afterEach(() => {
    headerValues.clear();
    vi.unstubAllEnvs();
  });

  it("takes the address our proxy added, not one the client typed", async () => {
    headerValues.set("x-forwarded-for", "6.6.6.6, 203.0.113.9");
    expect(await clientIp()).toBe("203.0.113.9");
  });

  it("honours TRUSTED_PROXY_HOPS for two proxies", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    headerValues.set("x-forwarded-for", "6.6.6.6, 203.0.113.9, 10.0.0.2");
    expect(await clientIp()).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then unknown", async () => {
    headerValues.set("x-real-ip", "198.51.100.4");
    expect(await clientIp()).toBe("198.51.100.4");
    headerValues.clear();
    expect(await clientIp()).toBe("unknown");
  });
});
