// The authorization grid: every public server action, called by account A with
// account B's ids and with forged ownership fields. Nothing may succeed against
// B, and nothing may change what B sees.
import { beforeAll, describe, expect, it } from "vitest";

import { accounts, actionIds, BASE, callAction, callFormAction, getPage, haveAccounts, localEnv, serverIsUp, signIn } from "./client";

const up = await serverIsUp();

// Fields an attacker might add hoping the server trusts them.
const forged = (victimProfileId: string, victimBankId: string) => ({
  userId: victimProfileId,
  ownerId: victimProfileId,
  $id: victimBankId,
  bankId: victimBankId,
  appwriteItemId: victimBankId,
  senderId: victimProfileId,
});

describe.skipIf(!up || !haveAccounts)(`authorization grid against ${BASE}`, () => {
  let a: string;
  let b: string;
  let victimBank: string;
  let victimProfile: string;
  let victimBefore: string;
  const MARK = "GRIDVICTIM";

  beforeAll(async () => {
    ({ cookie: a } = await signIn(accounts.a.email, accounts.a.password));
    ({ cookie: b } = await signIn(accounts.b.email, accounts.b.password));
    const file = new File([`Date,Narration,Debit,Credit,Balance\n05/04/2024,UPI ${MARK} RENT,100.00,,900.00\n`], "grid.csv", { type: "text/csv" });
    const imported = await callFormAction("importStatement", { file, institution: "Grid Victim Bank", mask: "7777" }, { cookie: b });
    victimBank = (imported.value as { bankId: string }).bankId;
    // B's real profile id (what bank rows carry as userId). Pages never show it, so the
    // test reads it with the server key: assume the attacker learned it somehow.
    const env = localEnv();
    const res = await fetch(
      `${env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_BANK_COLLECTION_ID}/documents/${victimBank}`,
      { headers: { "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT, "X-Appwrite-Key": env.NEXT_APPWRITE_KEY } }
    );
    victimProfile = ((await res.json()) as { userId: string }).userId;
    expect(victimProfile).toMatch(/^[a-z0-9]{10,}$/);
    victimBefore = (await getPage(`/transaction-history?id=${victimBank}`, b)).html;
    expect(victimBank).toBeTruthy();
  });

  // [action, args as A, what must hold]
  const grid: [string, () => unknown[], (value: unknown) => void][] = [
    ["setCardDesign", () => [{ ...forged(victimProfile, victimBank), appwriteItemId: victimBank, design: "auto" }], (v) => expect(v).toMatchObject({ ok: false })],
    [
      "sendTransfer",
      () => [{ senderBank: victimBank, sharableId: "x", amount: "1.00", name: "grid test", email: "a@example.com", idempotencyKey: crypto.randomUUID(), ...forged(victimProfile, victimBank) }],
      (v) => expect(v).toMatchObject({ ok: false, field: "senderBank" }),
    ],
    ["completeSetuConsent", () => [{ consentId: "consent-of-b", ...forged(victimProfile, victimBank) }], (v) => expect(v).toMatchObject({ status: "MISSING" })],
    ["correctTransaction", () => [{ ...forged(victimProfile, victimBank), accountId: victimBank, transactionId: "any", category: "Rent", everyPayment: true }], (v) => expect(v).toMatchObject({ ok: false })],
    ["undoCorrection", () => [{ ...forged(victimProfile, victimBank), accountId: victimBank, transactionId: "any" }], (v) => expect(v).toMatchObject({ ok: false })],
    ["deleteBank", () => [{ ...forged(victimProfile, victimBank), appwriteItemId: victimBank }], (v) => expect(v).toMatchObject({ ok: false })],
    ["deleteMyAccount", () => [{ ...forged(victimProfile, victimBank), password: "not-the-password" }], (v) => expect(v).toMatchObject({ ok: false })],
    [
      "exportMyData",
      () => [forged(victimProfile, victimBank)],
      (v) => {
        expect(v).toMatchObject({ ok: true });
        expect((v as { json: string }).json).not.toContain(MARK); // A's export has nothing of B's
      },
    ],
    ["createSetuConsent", () => [{ mobile: "9876543210", ...forged(victimProfile, victimBank) }], (v) => expect(JSON.stringify(v)).not.toMatch(/consentId/)],
    ["exchangePublicToken", () => [{ publicToken: "public-sandbox-forged", ...forged(victimProfile, victimBank) }], (v) => expect(v).toBeNull()],
    ["createLinkToken", () => [forged(victimProfile, victimBank)], () => {}],
    ["signIn", () => [{ email: accounts.b.email, password: "not-bs-password", ...forged(victimProfile, victimBank) }], (v) => expect(v).toMatchObject({ ok: false })],
    ["signUp", () => [{ email: accounts.b.email, password: "x", ...forged(victimProfile, victimBank) }], (v) => expect(v).toMatchObject({ ok: false })],
  ];

  it("covers every public action", () => {
    const covered = new Set([...grid.map(([name]) => name), "previewStatement", "importStatement", "logoutAccount"]);
    expect([...covered].sort()).toEqual(Object.keys(actionIds()).sort());
  });

  it.each(grid.map(([name, args, check]) => [name, args, check] as const))("%s as A with B's ids and forged owner fields", async (name, args, check) => {
    const { status, value } = await callAction(name, args(), { cookie: a, path: "/my-banks" });
    expect(status).toBe(200);
    check(value);
  });

  it("statement preview and import as A, naming B everywhere, stay A's", async () => {
    const mark = `GRIDPLANT${Date.now()}`;
    const file = new File([`Date,Narration,Debit,Credit,Balance\n06/04/2024,${mark},1.00,,1.00\n`], "plant.csv", { type: "text/csv" });
    for (const name of ["previewStatement", "importStatement"]) {
      const { value } = await callFormAction(name, { file, ...forged(victimProfile, victimBank), institution: "Grid Plant Bank", mask: "7776" }, { cookie: a });
      expect(value, name).toMatchObject({ ok: true });
      if (name === "importStatement") expect((value as { bankId: string }).bankId).not.toBe(victimBank);
    }
    expect((await getPage(`/transaction-history?id=${victimBank}`, b)).html).not.toContain(mark);
  });

  it("logoutAccount as A does not end B's session", async () => {
    const { cookie: spareA } = await signIn(accounts.a.email, accounts.a.password);
    await callAction("logoutAccount", [forged(victimProfile, victimBank)], { cookie: spareA, path: "/my-banks" });
    expect((await getPage("/my-banks", b)).status).toBe(200);
  });

  it("after all of that, B's data is unchanged", async () => {
    const after = (await getPage(`/transaction-history?id=${victimBank}`, b)).html;
    expect(after).toContain(MARK);
    const rows = (html: string) => (html.match(new RegExp(MARK, "g")) ?? []).length;
    expect(rows(after)).toBe(rows(victimBefore));
  });
});
