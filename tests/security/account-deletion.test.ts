// End to end: a brand-new throwaway account signs up, uploads a statement,
// deletes itself, and afterwards can neither sign in nor use its old session.
import { describe, expect, it } from "vitest";

import { allowSkip, BASE, callAction, callFormAction, getPage, serverIsUp, sessionCookie } from "./client";

const up = await serverIsUp();

describe.skipIf(!up && allowSkip)(`deleting an account against ${BASE}`, () => {
  const email = `horizon-delete-test-${Date.now()}@example.com`;
  const password = `Del-${crypto.randomUUID()}`;

  it("signs up, uploads, deletes itself, and is gone", async () => {
    // An Indian address, so no Dwolla customer is created for this throwaway account.
    const signUp = await callAction("signUp", [
      { email, password, firstName: "Delete", lastName: "Test", address1: "1 Test Road", city: "Pune", state: "MH", postalCode: "411001", dateOfBirth: "1990-01-01", ssn: "1234" },
    ]);
    expect(signUp.value).toMatchObject({ ok: true });
    const cookie = sessionCookie(signUp.setCookies)!;
    expect(cookie).toBeTruthy();

    const file = new File(["Date,Narration,Debit,Credit,Balance\n01/04/2024,DELETEME ROW,5.00,,95.00\n"], "statement.csv", { type: "text/csv" });
    expect((await callFormAction("importStatement", { file, institution: "Delete Test Bank", mask: "0001" }, { cookie })).value).toMatchObject({ ok: true });

    // A wrong password changes nothing.
    expect((await callAction("deleteMyAccount", [{ password: "wrong-password" }], { cookie, path: "/my-data" })).value).toMatchObject({ ok: false });
    expect((await getPage("/my-banks", cookie)).html).toContain("Delete Test Bank");

    // The real thing.
    const deleted = await callAction("deleteMyAccount", [{ password }], { cookie, path: "/my-data" });
    expect(deleted.value).toEqual({ ok: true });

    // The old session no longer works, and neither does the password.
    expect((await getPage("/my-banks", cookie)).location ?? "").toMatch(/\/sign-in/);
    expect((await callAction("signIn", [{ email, password }])).value).toMatchObject({ ok: false });
  });
});
