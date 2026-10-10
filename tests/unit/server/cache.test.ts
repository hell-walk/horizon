import { afterEach, describe, expect, it, vi } from "vitest";

// The cache module reads where it runs when it loads, so each case loads it afresh.
const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/cache");
};

afterEach(() => vi.unstubAllEnvs());

describe("cache on one server", () => {
  it("keeps a user's bank list between requests until it is invalidated", async () => {
    const { cached, invalidate, TTL } = await load({ VERCEL: "", MULTI_INSTANCE: "" });
    let calls = 0;
    const fetch = async () => ++calls;
    await cached("banks:u1", TTL.short, fetch);
    await cached("banks:u1", TTL.short, fetch);
    expect(calls).toBe(1);
    invalidate("banks:");
    await cached("banks:u1", TTL.short, fetch);
    expect(calls).toBe(2);
  });
});

describe("cache with several server copies (Vercel)", () => {
  it("never keeps a user's data from one request to the next: another copy may have changed it", async () => {
    const { cached, TTL } = await load({ VERCEL: "1" });
    let calls = 0;
    const fetch = async () => ++calls;
    // Outside a request (as here) each call is a request of its own.
    await cached("banks:u1", TTL.short, fetch);
    await cached("statement:b1", TTL.short, fetch);
    await cached("goals:a1", TTL.short, fetch);
    await cached("banks:u1", TTL.short, fetch);
    expect(calls).toBe(4);
  });

  it("still caches outside data (Plaid, exchange rates)", async () => {
    const { cached, TTL } = await load({ VERCEL: "1" });
    let calls = 0;
    const fetch = async () => ++calls;
    await cached("rates:INR:USD", TTL.day, fetch);
    await cached("rates:INR:USD", TTL.day, fetch);
    expect(calls).toBe(1);
  });

  it("does not remember a failure", async () => {
    const { cached, TTL } = await load({ MULTI_INSTANCE: "1" });
    await expect(cached("banks:u2", TTL.short, async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(await cached("banks:u2", TTL.short, async () => "fine")).toBe("fine");
  });
});
