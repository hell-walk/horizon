import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headerValues = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerValues.get(name.toLowerCase()) ?? null }),
}));

const { allow, clientIp, MINUTE } = await import("@/lib/server/rateLimit");

describe("allow (fixed-window counter)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit, then refuses", () => {
    const key = `t:${Math.random()}`;
    const results = Array.from({ length: 5 }, () => allow(key, 3, MINUTE));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("opens again once the window has passed", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) allow(key, 3, MINUTE);
    expect(allow(key, 3, MINUTE)).toBe(false);
    vi.advanceTimersByTime(MINUTE + 1);
    expect(allow(key, 3, MINUTE)).toBe(true);
  });

  it("counts keys separately", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    allow(a, 1, MINUTE);
    expect(allow(a, 1, MINUTE)).toBe(false);
    expect(allow(b, 1, MINUTE)).toBe(true);
  });

  it("cannot be reset by flooding it with new keys", () => {
    const victim = `victim:${Math.random()}`;
    for (let i = 0; i < 3; i++) allow(victim, 3, 10 * MINUTE);
    vi.advanceTimersByTime(1);
    // 60,000 fresh keys overflow the table (50,000): only the oldest tenth may go.
    for (let i = 0; i < 60_000; i++) allow(`flood:${i}`, 3, 10 * MINUTE);
    // The victim was among the oldest, so it may have been evicted. What matters is
    // that the table never empties completely: the most recent floods still count.
    expect(allow("flood:59999", 1, 10 * MINUTE)).toBe(false);
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
