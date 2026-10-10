// What a signed-in user (account A) can do to someone else (account B), to the
// server, and to Appwrite directly with their own session.
import { beforeAll, describe, expect, it } from "vitest";

import { sampleStatement, readStatementRows } from "@/lib/statements/parse";

import { longPdf, zipBomb } from "../helpers/files";
import { accounts, BASE, callAction, callFormAction, getPage, haveAccounts, localEnv, serverIsUp, signIn } from "./client";

const up = await serverIsUp();

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
        { file: csv(`Date,Narration,Debit,Credit,Balance\n04/04/2024,"${payload}",1.00,,1.00\n`), institution: "XSS Test Bank", mask: "4242" },
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

  describe("going around Horizon, straight to Appwrite with A's own session", () => {
    const env = localEnv();
    const endpoint = env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const appwrite = (path: string, init: RequestInit = {}) =>
      fetch(`${endpoint}${path}`, {
        ...init,
        headers: {
          "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT,
          "X-Appwrite-Session": decodeURIComponent(a.split("=")[1]),
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });

    it.each(["APPWRITE_USER_COLLECTION_ID", "APPWRITE_BANK_COLLECTION_ID", "APPWRITE_TRANSACTION_COLLECTION_ID", "APPWRITE_STATEMENT_COLLECTION_ID"])(
      "cannot list %s",
      async (key) => {
        const res = await appwrite(`/databases/${env.APPWRITE_DATABASE_ID}/collections/${env[key]}/documents`);
        expect(res.status).toBe(401);
      }
    );

    it("cannot write a bank row directly", async () => {
      const res = await appwrite(`/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_BANK_COLLECTION_ID}/documents`, {
        method: "POST",
        body: JSON.stringify({ documentId: "unique()", data: { userId: "x", bankId: "x", accountId: "x", accessToken: "x", sharableId: "x" } }),
      });
      expect(res.status).toBe(401);
    });

    it("the session really is A's (so the 401s above are permissions, not a bad session)", async () => {
      const res = await appwrite("/account");
      expect(res.status).toBe(200);
    });

    it("a poisoned saved layout in A's own preferences is ignored by the server", async () => {
      const oddText = "Kontoauszug\nBuchung;Vorgang;Ref;Betrag;Saldo\n01.04.2024;Swiggy;R1;-640;1000\n02.04.2024;Salary;R2;5000;6000\n";
      const { signature } = sampleStatement(await readStatementRows({ name: "o.csv", buffer: Buffer.from(oddText) }));
      const current = (await (await appwrite("/account/prefs")).json()) as Record<string, unknown>;
      const poisoned = { ...current, statementLayouts: { [signature]: { date: "constructor", name: { $gt: "" }, amount: -1 } } };
      expect((await appwrite("/account/prefs", { method: "PATCH", body: JSON.stringify({ prefs: poisoned }) })).status).toBe(200);
      try {
        const { value } = await callFormAction("previewStatement", { file: csv(oddText) }, { cookie: a });
        expect(value).toMatchObject({ ok: false, needsMapping: true }); // treated as no saved layout
      } finally {
        await appwrite("/account/prefs", { method: "PATCH", body: JSON.stringify({ prefs: current }) });
      }
    });
  });

  describe("session lifecycle", () => {
    it("the session cookie is HttpOnly, SameSite=Strict, Secure and short-lived", async () => {
      const { result } = await signIn(accounts.a.email, accounts.a.password);
      const cookie = result.setCookies.find((c) => c.startsWith("banking-session="))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Secure/i);
      const expires = Date.parse(cookie.match(/Expires=([^;]+)/i)![1]);
      expect(expires - Date.now()).toBeLessThanOrEqual(30 * 86400_000 + 60_000);
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
