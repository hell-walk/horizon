import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { scrubEvent } from "@/lib/scrub";

const root = join(__dirname, "../..");

describe("Sentry privacy", () => {
  it.each(["sentry.server.config.ts", "sentry.edge.config.ts", "src/instrumentation-client.ts"])("%s turns off collection and scrubs events", (file) => {
    const text = readFileSync(join(root, file), "utf8");
    expect(text).toMatch(/dataCollection:\s*\{\s*userInfo: false, cookies: false, httpHeaders: false, httpBodies: \[\], urlQueryParams: false\s*\}/);
    expect(text).toContain("beforeSend: (event) => scrubEvent(event)");
  });

  it("records no sessions at all (no replay integration, both sample rates 0)", () => {
    const text = readFileSync(join(root, "src/instrumentation-client.ts"), "utf8");
    expect(text).toContain("replaysSessionSampleRate: 0,");
    expect(text).toContain("replaysOnErrorSampleRate: 0,");
    expect(text).not.toContain("replayIntegration");
  });

  it("scrubEvent drops what a request carried and masks secrets in messages", () => {
    const event = scrubEvent({
      message: "sign-in failed for ada@example.com with token=abc123",
      request: {
        cookies: { "banking-session": "secret" },
        data: '{"password":"hunter2"}',
        query_string: "id=1",
        headers: { Cookie: "banking-session=secret", Authorization: "Bearer x", "Next-Action": "abc", "User-Agent": "test" },
      },
      user: { id: "u1", email: "ada@example.com", ip_address: "1.2.3.4" },
      exception: { values: [{ value: "Plaid failed for access-sandbox-1234abcd-5678 acct 123456789012" }] },
      breadcrumbs: [{ message: "fetch secret=zzz", data: { body: "statement contents" } }],
      extra: { statement: "UPI RAMESH KUMAR 500" },
    });
    const text = JSON.stringify(event);
    for (const leaked of ["banking-session", "hunter2", "Bearer", "ada@example.com", "1.2.3.4", "1234abcd", "123456789012", "zzz", "statement contents", "RAMESH"]) {
      expect(text, leaked).not.toContain(leaked);
    }
    expect(event.request?.headers).toEqual({ "User-Agent": "test" });
    expect(event.user).toEqual({ id: "u1" });
  });
});
