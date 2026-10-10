// What someone without an account can reach.
import { beforeAll, describe, expect, it } from "vitest";

import { actionIds, allowSkip, BASE, callAction, callFormAction, getPage, serverIsUp } from "./client";

const up = await serverIsUp();

describe("security test environment", () => {
  it(`a production build of Horizon answers at ${BASE}`, () => {
    if (!allowSkip) expect(up, "Start one with: npm run build && npx next start -p 3100").toBe(true);
  });
});

describe.skipIf(!up)(`anonymous attacker against ${BASE}`, () => {
  let signInPage: Awaited<ReturnType<typeof getPage>>;
  beforeAll(async () => {
    signInPage = await getPage("/sign-in");
  });

  describe("security headers", () => {
    it.each([
      ["strict-transport-security", /max-age=31536000/],
      ["x-content-type-options", /^nosniff$/],
      ["x-frame-options", /^DENY$/],
      ["referrer-policy", /strict-origin-when-cross-origin/],
      ["permissions-policy", /camera=\(\)/],
      ["content-security-policy", /frame-ancestors 'none'/],
    ])("%s", (name, pattern) => {
      expect(signInPage.headers.get(name)).toMatch(pattern);
    });

    it("CSP allows no eval and no plugins in production", () => {
      const csp = signInPage.headers.get("content-security-policy") ?? "";
      expect(csp).not.toContain("unsafe-eval");
      expect(csp).toContain("object-src 'none'");
    });

    it("does not announce the framework", () => {
      expect(signInPage.headers.get("x-powered-by")).toBeNull();
    });
  });

  describe("signed-in pages", () => {
    it.each(["/", "/my-banks", "/transaction-history", "/payment-transfer", "/connect-bank", "/setu/callback", "/transaction-history?id=anything", "/my-data", "/bills", "/goals", "/welcome", "/plans", "/feedback"])(
      "%s sends you to sign in",
      async (path) => {
        const page = await getPage(path);
        expect([302, 303, 307, 308]).toContain(page.status);
        expect(page.location).toMatch(/\/sign-in/);
      }
    );

    it("a forged or stale session cookie gets nowhere", async () => {
      // A token that looks right but is not signed by Supabase ("alg": "none").
      const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
      const fakeJwt = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000000", role: "authenticated", exp: 4102444800 })}.`;
      const forgedSession = "base64-" + b64({ access_token: fakeJwt, refresh_token: "forged", expires_at: 4102444800, token_type: "bearer", user: { id: "x" } });
      for (const cookie of ["horizon-session=forged", "horizon-session=", "horizon-session=" + "a".repeat(4096), `horizon-session=${forgedSession}`, "banking-session=forged"]) {
        const page = await getPage("/my-banks", cookie);
        expect(page.location ?? "", cookie.slice(0, 30)).toMatch(/\/sign-in/);
      }
    });

    it("setting a new password needs the emailed link first", async () => {
      const page = await getPage("/reset-password");
      expect(page.location ?? "").toMatch(/\/forgot-password\?expired=1/);
    });
  });

  describe("the Razorpay webhook", () => {
    // Only Razorpay knows the webhook secret: anything else must change nothing.
    const post = (headers: Record<string, string>) =>
      fetch(`${BASE}/api/razorpay/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_forged", status: "active", notes: { login: "00000000-0000-0000-0000-000000000000" } } } } }),
      });

    it("refuses a message without a signature", async () => {
      expect((await post({})).status).toBe(401);
    });

    it("refuses a made-up signature", async () => {
      expect((await post({ "X-Razorpay-Signature": "a".repeat(64) })).status).toBe(401);
    });
  });

  describe("coming back from Google or a reset email (/auth/callback)", () => {
    it("a made-up code signs nobody in", async () => {
      const page = await getPage("/auth/callback?code=forged-code");
      expect(page.location ?? "").toMatch(/\/sign-in\?failed=1/);
      expect(page.headers.getSetCookie().filter((c) => /^horizon-session[^=]*=[^;]/.test(c))).toEqual([]);
    });

    it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])("never sends anyone off the site (next=%s)", async (next) => {
      const page = await getPage(`/auth/callback?code=forged&next=${encodeURIComponent(next)}`);
      expect(new URL(page.location ?? "/", BASE).origin).toBe(new URL(BASE).origin);
    });
  });

  describe("the server action surface", () => {
    it("exposes exactly the intended actions", () => {
      expect(Object.keys(actionIds()).sort()).toEqual(
        [
          "cancelMySubscription",
          "checkSubscription",
          "completeProfile",
          "completeSetuConsent",
          "correctTransaction",
          "createLinkToken",
          "createSetuConsent",
          "deleteBank",
          "deleteGoal",
          "deleteMyAccount",
          "exchangePublicToken",
          "exportMyData",
          "importStatement",
          "logoutAccount",
          "previewStatement",
          "requestPasswordReset",
          "sendFeedback",
          "saveGoal",
          "sendTransfer",
          "setAccountDigits",
          "setCardDesign",
          "setNewPassword",
          "signIn",
          "signInWithGoogle",
          "signUp",
          "startSubscription",
          "undoCorrection",
        ].sort()
      );
    });

    it("an unknown action id is refused", async () => {
      const res = await fetch(`${BASE}/sign-in`, {
        method: "POST",
        headers: { "Next-Action": "00" + "ab".repeat(20), "Content-Type": "text/plain;charset=UTF-8", Origin: BASE },
        body: "[]",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it.each([
      ["sendTransfer", [{ senderBank: "x", sharableId: "y", amount: "1", name: "test", email: "a@b.co", idempotencyKey: crypto.randomUUID() }]],
      ["setCardDesign", [{ appwriteItemId: "x", design: "auto" }]],
      ["createLinkToken", []],
      ["exchangePublicToken", [{ publicToken: "public-sandbox-x" }]],
      ["createSetuConsent", [{ mobile: "9876543210" }]],
      ["completeSetuConsent", [{ consentId: "x" }]],
      ["deleteBank", [{ appwriteItemId: "x" }]],
      ["exportMyData", []],
      ["deleteMyAccount", [{ password: "x" }]],
      ["correctTransaction", [{ accountId: "x", transactionId: "x", category: "Rent" }]],
      ["undoCorrection", [{ accountId: "x", transactionId: "x" }]],
      ["saveGoal", [{ name: "Trip", target: 100 }]],
      ["deleteGoal", [{ id: "g-x" }]],
    ])("%s refuses without a session", async (name, args) => {
      const { status, value } = await callAction(name, args);
      expect(status).toBe(200);
      const text = JSON.stringify(value);
      expect(text).toMatch(/signed in|null|MISSING|"ok":false/);
      expect(text).not.toMatch(/"ok":true|link-sandbox/);
    });

    it("statement preview and import refuse without a session", async () => {
      const file = new Blob(["Date,Narration,Debit,Credit,Balance\n01/04/2024,X,1.00,,1.00\n"]);
      for (const name of ["previewStatement", "importStatement"]) {
        const { value } = await callFormAction(name, { file });
        expect(value).toMatchObject({ ok: false, error: expect.stringMatching(/signed in/) });
      }
    });
  });

  describe("cross-site requests (CSRF)", () => {
    it("rejects a server action posted from another site", async () => {
      const { status, raw } = await callAction("signIn", [{ email: "x@example.com", password: "x" }], { origin: "https://evil.example" });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(raw).not.toMatch(/"ok":/);
    });

    // Next.js compares Origin with X-Forwarded-Host. Only a proxy in front of the
    // app can stop a client from choosing that header, so this check means
    // something only behind one (staging or production): set HORIZON_BEHIND_PROXY=1.
    // Locally there is no proxy and the header is the client's own.
    if (process.env.HORIZON_BEHIND_PROXY === "1") {
      it("rejects a forged Origin even with a matching forged X-Forwarded-Host", async () => {
        const { status, raw } = await callAction("signIn", [{ email: "x@example.com", password: "x" }], {
          origin: "https://evil.example",
          headers: { "X-Forwarded-Host": "evil.example" },
        });
        expect(status).toBeGreaterThanOrEqual(400);
        expect(raw).not.toMatch(/"ok":/);
      });
    }
  });

  describe("brute force", () => {
    it("locks an email after 8 wrong passwords, even when the attacker changes IP headers", async () => {
      const email = `nobody-${Date.now()}@example.com`; // not a real account: no one is locked out
      const answers: string[] = [];
      for (let i = 0; i < 10; i++) {
        const { value } = await callAction("signIn", [{ email, password: `guess-${i}` }], { headers: { "X-Forwarded-For": `203.0.113.${i}` } });
        answers.push((value as { error?: string })?.error ?? "");
      }
      expect(answers.slice(0, 8).every((a) => a === "Invalid email or password.")).toBe(true);
      expect(answers[8]).toMatch(/Too many attempts/);
      expect(answers[9]).toMatch(/Too many attempts/);
    });

    it("gives the same answer for a wrong password and a missing account", async () => {
      const { value } = await callAction("signIn", [{ email: `ghost-${Date.now()}@example.com`, password: "x" }]);
      expect(value).toEqual({ ok: false, error: "Invalid email or password." });
    });
  });

  describe("malformed requests", () => {
    it.each([
      ["not json", "{{{"],
      ["wrong shape", '{"email":1}'],
      ["huge", JSON.stringify([{ email: "a".repeat(200_000), password: "b" }])],
      ["prototype pollution", '[{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"email":"a@b.co","password":"x"}]'],
    ])("%s: no crash details leak", async (_label, body) => {
      const id = actionIds().signIn;
      const res = await fetch(`${BASE}/sign-in`, {
        method: "POST",
        headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Origin: BASE },
        body,
      });
      const text = await res.text();
      expect(text).not.toMatch(/at [\w.<>]+ \(|node_modules|[A-Z]:\\|\/src\/lib|appwrite\.io|NEXT_APPWRITE/i);
    });

    it("the server still answers after all of that", async () => {
      expect((await getPage("/sign-in")).status).toBe(200);
    });
  });

  describe("files that should never be served", () => {
    it.each(["/.env", "/.env.local", "/_next/../.env", "/%2e%2e/.env", "/.git/config", "/package.json", "/next.config.ts", "/.next/server/server-reference-manifest.json"])(
      "%s",
      async (path) => {
        const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
        const text = await res.text();
        expect(text).not.toMatch(/APPWRITE|DWOLLA_SECRET|PLAID_SECRET|\[core\]|"dependencies"|exportedName/);
      }
    );

    it("client source maps are not public", async () => {
      const scripts = [...signInPage.html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 5);
      expect(scripts.length).toBeGreaterThan(0);
      for (const src of scripts) {
        const res = await fetch(`${BASE}${src}.map`);
        expect(res.status, src).not.toBe(200);
      }
    });
  });

  describe("Sentry tunnel (/monitoring)", () => {
    it("does not relay to someone else's Sentry project", async () => {
      const envelope = `${JSON.stringify({ dsn: "https://abc@o1.ingest.sentry.io/999999" })}\n{"type":"event"}\n{}`;
      const res = await fetch(`${BASE}/monitoring?o=1&p=999999`, { method: "POST", body: envelope });
      expect(res.status).not.toBe(200);
    });
  });
});
