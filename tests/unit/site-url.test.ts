import { afterEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "@/lib/site";

// Links that leave the site and come back (Google, emails, bank consent) use this address.
describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is the configured address, without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://horizon.example/");
    expect(siteUrl()).toBe("https://horizon.example");
  });

  it("on the live Vercel site, refuses localhost or plain http instead of sending people there", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const bad of ["http://localhost:3000", "https://localhost:3000", "http://horizon.example", "https://127.0.0.1"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", bad);
      expect(() => siteUrl(), bad).toThrow(/https address/);
    }
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://horizon.example");
    expect(siteUrl()).toBe("https://horizon.example");
  });

  it("local development and preview deployments may use localhost", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
