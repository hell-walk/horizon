import { afterAll, describe, expect, it } from "vitest";

import { BASE, callAction, callFormAction, getPage, localEnv, serverIsUp, signIn } from "./client";

// End to end, on the real stack: a confirmed login whose sign-up details are
// waiting (what clicking the confirmation email leaves), its first visit
// creating the profile, an upload, then deleting itself. Sign-up itself only
// sends an email, so the confirmed login is made with the Supabase service key
// (from the local .env), as if the link had been opened.
const up = await serverIsUp();
const env = localEnv();
const supabaseReady = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!up || !supabaseReady)(`account deletion against ${BASE}`, () => {
  const email = `horizon-delete-test-${Date.now()}@example.com`;
  const password = `Del-${crypto.randomUUID()}`;
  const admin = (path: string, init: RequestInit = {}) =>
    fetch(`${env.SUPABASE_URL}/auth/v1/admin${path}`, {
      ...init,
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    });
  let loginId = "";

  afterAll(async () => {
    // If the test failed half-way, do not leave the throwaway login behind.
    if (loginId) await admin(`/users/${loginId}`, { method: "DELETE" }).catch(() => {});
  });

  it("confirms, finishes setting up, uploads, deletes itself, and is gone", async () => {
    // An Indian address, so no Dwolla customer is created for this throwaway account.
    const created = await admin("/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: "Delete Test",
          terms_accepted_at: new Date().toISOString(),
          pending_profile: { country: "IN", firstName: "Delete", lastName: "Test", address1: "1 Test Road", city: "Pune", state: "MH", postalCode: "411001" },
        },
      }),
    });
    expect(created.status).toBe(200);
    loginId = ((await created.json()) as { id: string }).id;

    const { cookie } = await signIn(email, password);
    // No profile yet: the app sends the first visit to /welcome, which makes it from the waiting details.
    expect((await getPage("/my-banks", cookie)).location ?? "").toMatch(/\/welcome/);
    expect((await getPage("/welcome", cookie)).location ?? "").toMatch(/\/$/);
    expect((await getPage("/my-banks", cookie)).status).toBe(200);

    const file = new File(["Date,Narration,Debit,Credit,Balance\n01/04/2024,DELETEME ROW,5.00,,95.00\n"], "statement.csv", { type: "text/csv" });
    expect((await callFormAction("importStatement", { file, institution: "Delete Test Bank", mask: "0001" }, { cookie })).value).toMatchObject({ ok: true });

    // A wrong password changes nothing.
    expect((await callAction("deleteMyAccount", [{ password: "wrong-password" }], { cookie, path: "/my-data" })).value).toMatchObject({ ok: false });
    expect((await getPage("/my-banks", cookie)).html).toContain("Delete Test Bank");

    // The real thing.
    const deleted = await callAction("deleteMyAccount", [{ password }], { cookie, path: "/my-data" });
    expect(deleted.value).toEqual({ ok: true });
    loginId = "";

    // The old session no longer works, and neither does the password.
    expect((await getPage("/my-banks", cookie)).location ?? "").toMatch(/\/sign-in/);
    expect((await callAction("signIn", [{ email, password }])).value).toMatchObject({ ok: false });
  });
});
