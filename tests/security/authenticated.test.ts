// What a signed-in user (account A) can do to someone else (account B), to the
// server, and to Appwrite directly with their own session.
import { beforeAll, describe, expect, it } from "vitest";

import { sampleStatement, readStatementRows } from "@/lib/statements/parse";

import { longPdf, zipBomb } from "../helpers/files";
import { accounts, allowSkip, BASE, callAction, callFormAction, getPage, haveAccounts, localEnv, serverIsUp, signIn } from "./client";

const up = await serverIsUp();

describe("security test accounts", () => {
  it("two throwaway accounts are configured", () => {
    if (!allowSkip) expect(haveAccounts, "Set HORIZON_TEST_EMAIL/_PASSWORD and HORIZON_TEST_EMAIL_2/_PASSWORD_2").toBe(true);
  });
});

// B's statement: fixed content, so re-runs reuse the same bank and rows.
const VICTIM_BANK = "Victim Test Bank";
const VICTIM_MARK = "VICTIMSECRET";
const victimCsv = `Date,Narration,Debit,Credit,Balance\n01/04/2024,UPI ${VICTIM_MARK} RENT,500.00,,9500.00\n02/04/2024,NEFT ${VICTIM_MARK} SALARY,,1000.00,10500.00\n`;
const csv = (text: string, name = "statement.csv") => new File([text], name, { type: "text/csv" });

describe.skipIf(!up || !haveAccounts)(`signed-in attacker against ${BASE}`, () => {
  let a: string; // cookie for account A (attacker)
  let b: string; // cookie for account B (victim)
  let victimBankId: string;

  beforeAll(async () => {
    ({ cookie: a } = await signIn(accounts.a.email, accounts.a.password));
    ({ cookie: b } = await signIn(accounts.b.email, accounts.b.password));

    // B gets a bank of their own to attack.
    const imported = await callFormAction("importStatement", { file: csv(victimCsv), institution: VICTIM_BANK, mask: "9999" }, { cookie: b });
    expect(imported.value).toMatchObject({ ok: true });
    victimBankId = (imported.value as { bankId: string }).bankId;
    expect(victimBankId).toBeTruthy();
  });

  describe("reading someone else's data", () => {
    it.each(["/transaction-history", "/", "/my-banks", "/payment-transfer"])("%s?id=<B's bank> shows A nothing of B", async (path) => {
      const page = await getPage(`${path}?id=${victimBankId}`, a);
      expect(page.status).toBe(200);
      expect(page.html).not.toContain(VICTIM_MARK); // B's transactions
    });

    it("B can see their own data (the test is not vacuous)", async () => {
      const page = await getPage(`/transaction-history?id=${victimBankId}`, b);
      expect(page.html).toContain(VICTIM_MARK);
    });

    it("the selected-account cookie cannot point A at B's bank either", async () => {
      const page = await getPage("/transaction-history", `${a}; horizon-account=${victimBankId}`);
      expect(page.html).not.toContain(VICTIM_MARK);
    });
  });

  describe("changing someone else's data", () => {
    it("A cannot restyle B's card", async () => {
      const { value } = await callAction("setCardDesign", [{ appwriteItemId: victimBankId, design: "auto" }], { cookie: a, path: "/my-banks" });
      expect(value).toMatchObject({ ok: false, error: "That account is not yours." });
    });

    it("A cannot send money from B's account", async () => {
      const { value } = await callAction(
        "sendTransfer",
        [{ senderBank: victimBankId, sharableId: "anything", amount: "1.00", name: "steal it", email: "a@example.com", idempotencyKey: crypto.randomUUID() }],
        { cookie: a, path: "/payment-transfer" }
      );
      expect(value).toMatchObject({ ok: false, field: "senderBank" });
    });

    it("A cannot file a statement under B by naming B in the form", async () => {
      const mark = `PLANTED${Date.now()}`;
      const { value } = await callFormAction(
        "importStatement",
        { file: csv(`Date,Narration,Debit,Credit,Balance\n03/04/2024,${mark},1.00,,1.00\n`), userId: "victim", bankId: victimBankId, institution: "Planted Test Bank", mask: "9998" },
        { cookie: a }
      );
      expect(value).toMatchObject({ ok: true });
      const victimView = await getPage(`/transaction-history?id=${victimBankId}`, b);
      expect(victimView.html).not.toContain(mark);
    });
  });

  describe("script injection through statement text", () => {
    const payload = `<img src=x onerror=alert(document.cookie)>XSS${Date.now()}`;

    it("a narration with HTML is stored as text and rendered escaped", async () => {
      const { value } = await callFormAction(
        "importStatement",
        // Every run sends the same date, amount and balance with new wording: after the first run that
        // looks like an entry already saved, so say it is new (the box a user would tick).
        { file: csv(`Date,Narration,Debit,Credit,Balance\n04/04/2024,"${payload}",1.00,,1.00\n`), institution: "XSS Test Bank", mask: "4242", keepLikely: "1" },
        { cookie: a }
      );
      expect(value).toMatchObject({ ok: true });
      const bankId = (value as { bankId: string }).bankId;
      const page = await getPage(`/transaction-history?id=${bankId}`, a);
      expect(page.html).toContain(payload.slice(-16)); // the row is there
      expect(page.html).not.toContain("<img src=x onerror"); // but never as live HTML
    });

    it("a bank name with HTML cannot break out either", async () => {
      const { value } = await callFormAction(
        "previewStatement",
        { file: csv("Date,Narration,Debit,Credit,Balance\n01/04/2024,X,1.00,,1.00\n"), institution: '"><script>alert(1)</script>' },
        { cookie: a }
      );
      expect(value).toMatchObject({ ok: true });
    });

    it("fixes for rows that were not flagged, or malformed ones, are refused", async () => {
      // A clean file: nothing is flagged, so no row may be changed through "fixes".
      const file = csv("Date,Narration,Debit,Credit,Balance\n01/04/2024,CLEAN,1.00,,99.00\n02/04/2024,CLEAN 2,1.00,,98.00\n");
      for (const fixes of [JSON.stringify({ 0: { amount: 999999 } }), JSON.stringify({ 1: { type: "credit" } }), "{not json", "x".repeat(200_000)]) {
        const { value } = await callFormAction("previewStatement", { file, fixes }, { cookie: a });
        expect(value, fixes.slice(0, 30)).toMatchObject({ ok: false });
      }
    });
  });

  describe("hostile files (as a signed-in user)", () => {
    const timed = async <T,>(fn: () => Promise<T>) => {
      const t0 = performance.now();
      const result = await fn();
      return { result, ms: performance.now() - t0 };
    };

    it("a zip bomb is refused quickly", async () => {
      const bomb = new File([new Uint8Array(await zipBomb(60))], "statement.xlsx");
      const { result, ms } = await timed(() => callFormAction("previewStatement", { file: bomb }, { cookie: a }));
      expect(result.value).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
      expect(ms).toBeLessThan(3000);
    });

    it("a 250-page PDF is refused", async () => {
      const { value } = await callFormAction("previewStatement", { file: new File([new Uint8Array(longPdf(250))], "statement.pdf") }, { cookie: a });
      expect(value).toMatchObject({ ok: false, error: expect.stringMatching(/250 pages/) });
    });

    it("too many rows are refused", async () => {
      const rows = ["Date,Narration,Debit,Credit,Balance", ...Array.from({ length: 50_010 }, () => "1/4/24,X,1,,1")].join("\n");
      const { value } = await callFormAction("previewStatement", { file: csv(rows) }, { cookie: a });
      expect(value).toMatchObject({ ok: false, error: expect.stringMatching(/rows/) });
    });

    it("a legitimate 2 MB statement goes through", async () => {
      let balance = 1_000_000;
      let size = 0;
      const lines = ["Date,Narration,Debit,Credit,Balance"];
      while (size < 2 * 1024 * 1024) {
        balance -= 1;
        const line = `01/04/2024,UPI PAYMENT TO SOME MERCHANT WITH A LONG NARRATION ${lines.length},1.00,,${balance}.00`;
        lines.push(line);
        size += line.length + 1;
      }
      const { status, value } = await callFormAction("previewStatement", { file: csv(lines.join("\n")) }, { cookie: a });
      expect(status).toBe(200);
      expect(value).toMatchObject({ ok: true });
    });

    it("a 4.5 MB file gets the friendly size message (it fits in a request, not in the limit)", async () => {
      const file = new File([new Uint8Array(4.5 * 1024 * 1024)], "statement.csv");
      const { value } = await callFormAction("previewStatement", { file }, { cookie: a });
      expect(value).toMatchObject({ ok: false, error: expect.stringMatching(/larger than 4 MB/) });
    });

    it("a body over the limit is refused without crashing the server", async () => {
      const big = new File([new Uint8Array(12 * 1024 * 1024)], "statement.csv");
      // Next.js either answers with an error or closes the connection mid-upload; both are refusals.
      const outcome = await callFormAction("previewStatement", { file: big }, { cookie: a }).catch((e: Error) => e);
      if (!(outcome instanceof Error)) {
        expect(outcome.status >= 400 || (outcome.value as { ok?: boolean })?.ok === false).toBe(true);
      }
      // The client's pooled connection was cut; a fresh request shows the server itself is fine.
      let status = 0;
      for (let attempt = 0; attempt < 3 && status !== 200; attempt++) {
        status = await getPage("/sign-in").then((p) => p.status, () => 0);
        if (status !== 200) await new Promise((r) => setTimeout(r, 500));
      }
      expect(status).toBe(200);
    });

    it("mapping and password abuse is rejected cleanly", async () => {
      const odd = csv("Kontoauszug\nBuchung;Vorgang;Ref;Betrag;Saldo\n01.04.2024;Swiggy;R1;-640;1000\n02.04.2024;Salary;R2;5000;6000\n");
      for (const mapping of ['{"__proto__":{"date":0},"name":1,"amount":3}', '{"constructor":{"prototype":{"x":1}}}', "x".repeat(100_000)]) {
        const { value } = await callFormAction("previewStatement", { file: odd, mapping }, { cookie: a });
        expect(value, mapping.slice(0, 30)).toMatchObject({ ok: false, needsMapping: true });
      }
      const { raw } = await callFormAction("previewStatement", { file: odd, password: "p".repeat(5000) }, { cookie: a });
      expect(raw).not.toContain("pppppppppp");
    });

    it("the server is still responsive", async () => {
      const t0 = performance.now();
      expect((await getPage("/sign-in")).status).toBe(200);
      expect(performance.now() - t0).toBeLessThan(2000);
    });
  });

  describe("going around Horizon, straight to Appwrite", () => {
    const env = localEnv();
    const endpoint = env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    // What anyone can do: the project id is public. Horizon's sign-in is not an
    // Appwrite one, so there is no Appwrite session to borrow.
    const outsider = (path: string, init: RequestInit = {}) =>
      fetch(`${endpoint}${path}`, {
        ...init,
        headers: { "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT, "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    // The server key, for this test's own setup only.
    const server = (path: string, init: RequestInit = {}) => outsider(path, { ...init, headers: { "X-Appwrite-Key": env.NEXT_APPWRITE_KEY } });
    const profiles = `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_USER_COLLECTION_ID}/documents`;

    it.each(["APPWRITE_USER_COLLECTION_ID", "APPWRITE_BANK_COLLECTION_ID", "APPWRITE_TRANSACTION_COLLECTION_ID", "APPWRITE_STATEMENT_COLLECTION_ID"])(
      "cannot list %s",
      async (key) => {
        const res = await outsider(`/databases/${env.APPWRITE_DATABASE_ID}/collections/${env[key]}/documents`);
        expect(res.status).toBe(401);
      }
    );

    it("cannot write a bank row directly", async () => {
      const res = await outsider(`/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_BANK_COLLECTION_ID}/documents`, {
        method: "POST",
        body: JSON.stringify({ documentId: "unique()", data: { userId: "x", bankId: "x", accountId: "x", accessToken: "x", sharableId: "x" } }),
      });
      expect(res.status).toBe(401);
    });

    it("Horizon's session cookie opens nothing in Appwrite", async () => {
      const token = decodeURIComponent(a.split(";")[0].split("=")[1]);
      const res = await outsider("/account", { headers: { "X-Appwrite-Session": token } });
      expect(res.status).toBe(401);
    });

    it("a poisoned saved layout in A's own settings is ignored by the server", async () => {
      const oddText = "Kontoauszug\nBuchung;Vorgang;Ref;Betrag;Saldo\n01.04.2024;Swiggy;R1;-640;1000\n02.04.2024;Salary;R2;5000;6000\n";
      const { signature } = sampleStatement(await readStatementRows({ name: "o.csv", buffer: Buffer.from(oddText) }));
      const query = encodeURIComponent(JSON.stringify({ method: "equal", attribute: "email", values: [accounts.a.email] }));
      const profile = ((await (await server(`${profiles}?queries[]=${query}`)).json()) as { documents: { $id: string; prefs?: string }[] }).documents[0];
      expect(profile?.$id).toBeTruthy();
      const current = profile.prefs ?? "";
      const poisoned = { ...JSON.parse(current || "{}"), statementLayouts: { [signature]: { date: "constructor", name: { $gt: "" }, amount: -1 } } };
      const save = (prefs: string) => server(`${profiles}/${profile.$id}`, { method: "PATCH", body: JSON.stringify({ data: { prefs } }) });
      expect((await save(JSON.stringify(poisoned))).status).toBe(200);
      try {
        const { value } = await callFormAction("previewStatement", { file: csv(oddText) }, { cookie: a });
        expect(value).toMatchObject({ ok: false, needsMapping: true }); // treated as no saved layout
      } finally {
        await save(current);
      }
    });
  });

  describe("session lifecycle", () => {
    it("every piece of the session cookie is HttpOnly, SameSite=Lax, Secure and lasts at most 30 days", async () => {
      const { result } = await signIn(accounts.a.email, accounts.a.password);
      const pieces = result.setCookies.filter((c) => /^horizon-session(\.\d+)?=./.test(c));
      expect(pieces.length).toBeGreaterThan(0);
      for (const cookie of pieces) {
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Lax/i);
        expect(cookie).toMatch(/Secure/i);
        expect(Number(cookie.match(/Max-Age=(\d+)/i)![1])).toBeLessThanOrEqual(30 * 86400);
      }
    });

    it("logging out kills the session on the server, not just in the browser", async () => {
      const { cookie } = await signIn(accounts.a.email, accounts.a.password);
      expect((await getPage("/my-banks", cookie)).status).toBe(200);
      await callAction("logoutAccount", [], { cookie, path: "/my-banks" });
      const after = await getPage("/my-banks", cookie); // replaying the old cookie
      expect(after.location ?? "").toMatch(/\/sign-in/);
    });
  });
});
