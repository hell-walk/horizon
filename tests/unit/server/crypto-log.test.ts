import { afterEach, describe, expect, it, vi } from "vitest";

import { newSharableId, openSecret, sealSecret } from "@/lib/server/crypto";
import { describeError, logError, redact } from "@/lib/server/log";

describe("sealSecret / openSecret (AES-256-GCM)", () => {
  const token = "access-sandbox-1234abcd-5678-90ef";

  it("round-trips a token", () => {
    const sealed = sealSecret(token);
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("1234abcd");
    expect(openSecret(sealed)).toBe(token);
  });

  it("uses a fresh IV every time", () => {
    expect(sealSecret(token)).not.toBe(sealSecret(token));
  });

  it("detects tampering", () => {
    const sealed = sealSecret(token);
    const body = Buffer.from(sealed.slice("enc:v1:".length), "base64url");
    body[body.length - 1] ^= 1;
    expect(() => openSecret("enc:v1:" + body.toString("base64url"))).toThrow();
  });

  it("will not open with a different key", () => {
    const sealed = sealSecret(token);
    const original = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      expect(() => openSecret(sealed)).toThrow();
    } finally {
      process.env.DATA_ENCRYPTION_KEY = original;
    }
  });

  it("reads rows stored before encryption as they are", () => {
    expect(openSecret("access-sandbox-legacy")).toBe("access-sandbox-legacy");
  });

  it("refuses to run in production without a key", () => {
    const original = process.env.DATA_ENCRYPTION_KEY;
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATA_ENCRYPTION_KEY;
    try {
      expect(() => sealSecret(token)).toThrow(/DATA_ENCRYPTION_KEY/);
    } finally {
      process.env.DATA_ENCRYPTION_KEY = original;
      vi.unstubAllEnvs();
    }
  });

  it("rejects a key of the wrong length", () => {
    const original = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    try {
      expect(() => sealSecret(token)).toThrow(/32 bytes/);
    } finally {
      process.env.DATA_ENCRYPTION_KEY = original;
    }
  });

  it("makes random sharable ids", () => {
    const ids = new Set(Array.from({ length: 200 }, newSharableId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});

describe("log scrubbing", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs a failed Plaid call without its secrets", () => {
    const plaidError = Object.assign(new Error("Request failed with status code 400"), {
      name: "AxiosError",
      code: "ERR_BAD_REQUEST",
      config: { headers: { "PLAID-SECRET": "s3cr3t-value", "PLAID-CLIENT-ID": "client-123" }, data: '{"access_token":"access-sandbox-1234abcd-5678"}' },
      response: { status: 400, data: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", access_token: "access-sandbox-1234abcd-5678" } },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("plaid", plaidError);
    const written = spy.mock.calls.flat().join(" ");
    expect(written).toContain("ITEM_LOGIN_REQUIRED");
    expect(written).not.toMatch(/s3cr3t|client-123|access-sandbox-1234/);
  });

  it("keeps Appwrite and Dwolla codes", () => {
    expect(describeError(Object.assign(new Error("Document not found"), { code: 404, type: "document_not_found" }))).toContain("type=document_not_found");
    expect(describeError(Object.assign(new Error("Bad"), { body: { code: "ValidationError" } }))).toContain("dwolla=ValidationError");
  });

  it.each([
    ["token=abc123", "abc123"],
    ['"password":"hunter2"', "hunter2"],
    ["user@example.com", "user@example.com"],
    ["acct 123456789012", "123456789012"],
    ["access-production-9f9f-aa", "9f9f"],
    ["enc:v1:QUJDREVG", "QUJDREVG"],
    ["Authorization: Bearer xyz", "Bearer"],
  ])("redacts %s", (text, secret) => {
    expect(redact(text)).not.toContain(secret);
  });

  it("caps the length of what it writes", () => {
    expect(describeError(new Error("x".repeat(5000))).length).toBeLessThanOrEqual(500);
  });

  it("copes with non-errors", () => {
    expect(describeError(undefined)).toBe("");
    expect(describeError("plain text with user@example.com")).not.toContain("user@example.com");
  });
});
