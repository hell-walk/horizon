import { beforeEach, describe, expect, it, vi } from "vitest";

import { csvStatement, zipBomb } from "../../helpers/files";
import { transactionHash } from "@/lib/statements/parse";

const state = vi.hoisted(() => ({
  user: null as null | { $id: string; userId: string },
  prefs: {} as Record<string, unknown>,
  documents: [] as Record<string, unknown>[],
  existingBanks: [] as { $id: string }[],
  savedRows: [] as Record<string, unknown>[],
  listQueries: [] as string[][],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/auth")>()),
  getLoggedInUser: vi.fn(async () => state.user),
}));
vi.mock("@/lib/server/banks", () => ({
  createBankAccount: vi.fn(async (props: Record<string, unknown>) => ({ $id: "new-bank", ...props })),
}));
vi.mock("@/lib/server/appwrite", () => ({
  createAdminClient: async () => ({
    database: {
      listDocuments: vi.fn(async (_db: string, _col: string, queries: string[]) => {
        state.listQueries.push(queries);
        // Saved entries are listed by bank; banks by owner, provider, name and account ending.
        if (queries.some((q) => q.includes('"bankId"'))) {
          const after = queries.map((q) => JSON.parse(q)).find((q) => q.method === "cursorAfter")?.values?.[0];
          const start = after ? state.savedRows.findIndex((r) => r.$id === after) + 1 : 0;
          const page = state.savedRows.slice(start, start + 100);
          return { documents: page, total: state.savedRows.length };
        }
        return { documents: state.existingBanks, total: state.existingBanks.length };
      }),
      createDocument: vi.fn(async (_db: string, _col: string, _id: string, data: Record<string, unknown>) => {
        state.documents.push(data);
        return data;
      }),
      updateDocument: vi.fn(async () => ({})),
    },
    user: {
      getPrefs: vi.fn(async () => state.prefs),
      updatePrefs: vi.fn(async (_id: string, prefs: Record<string, unknown>) => {
        state.prefs = prefs;
        return prefs;
      }),
    },
  }),
}));

const { previewStatement, importStatement } = await import("@/lib/actions/statement.action");

let n = 0;
beforeEach(() => {
  const id = `profile-${++n}`;
  state.user = { $id: id, userId: `auth-${n}` };
  state.prefs = {};
  state.documents = [];
  state.existingBanks = [];
  state.savedRows = [];
  state.listQueries = [];
});

const form = (file: File | null, extra: Record<string, string> = {}) => {
  const fd = new FormData();
  if (file) fd.set("file", file);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
};
const csv = (text: string, name = "s.csv") => new File([text], name, { type: "text/csv" });
const good = "Date,Narration,Debit,Credit,Balance\n01/04/2024,UPI SWIGGY,640.00,,1000.00\n02/04/2024,NEFT SALARY,,5000.00,6000.00\n";
const odd = "Kontoauszug\nBuchung;Vorgang;Ref;Betrag;Saldo\n01.04.2024;Swiggy order;R1;-640;1000\n02.04.2024;Salary;R2;5000;6000\n03.04.2024;ATM;R3;-500;5500\n";

describe("previewStatement", () => {
  it("requires a signed-in user", async () => {
    state.user = null;
    expect(await previewStatement(form(csv(good)))).toMatchObject({ ok: false, error: expect.stringMatching(/signed in/) });
  });

  it("requires a file, and refuses one over 10 MB", async () => {
    expect(await previewStatement(form(null))).toMatchObject({ ok: false, error: "Choose a statement file first." });
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.csv");
    expect(await previewStatement(form(big))).toMatchObject({ ok: false, error: "The file is larger than 10 MB." });
  });

  it("reads a normal statement and checks its balances", async () => {
    const result = await previewStatement(form(csv(good)));
    expect(result).toMatchObject({ ok: true, total: 2, source: "auto", check: { status: "ok" } });
  });

  it("turns a zip bomb into a friendly message", async () => {
    const bomb = new File([new Uint8Array(await zipBomb(40))], "bomb.xlsx");
    expect(await previewStatement(form(bomb))).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
  });

  it("does not echo file contents or internals in errors", async () => {
    const junk = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "x.exe");
    const result = await previewStatement(form(junk));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/at \w+ \(|node_modules|stack/i);
  });

  it("asks for column mapping, with sample rows, when the layout is unknown", async () => {
    const result = await previewStatement(form(csv(odd)));
    expect(result).toMatchObject({ ok: false, needsMapping: true, sample: { width: 5 } });
  });

  it("validates the mapping the browser sends", async () => {
    for (const mapping of ["not json", "[1,2]", '{"date":0,"name":0,"amount":3}', '{"date":0,"name":1,"amount":99}', '{"__proto__":{"date":0},"name":1,"amount":3}']) {
      const result = await previewStatement(form(csv(odd), { mapping }));
      expect(result, mapping).toMatchObject({ ok: false, needsMapping: true });
    }
  });

  it("reads the file with a valid mapping", async () => {
    const result = await previewStatement(form(csv(odd), { mapping: JSON.stringify({ date: 0, name: 1, reference: 2, amount: 3, balance: 4 }) }));
    expect(result).toMatchObject({ ok: true, total: 3, source: "manual" });
  });

  it("caps password length and never returns the password", async () => {
    const result = await previewStatement(form(csv(good), { password: "x".repeat(10_000) }));
    expect(JSON.stringify(result)).not.toContain("xxxxxxxxxx");
  });

  it("limits one user to 30 reads per 10 minutes", async () => {
    const results = [];
    for (let i = 0; i < 31; i++) results.push(await previewStatement(form(csv(good))));
    expect(results.slice(0, 30).every((r) => r.ok)).toBe(true);
    expect(results[30]).toMatchObject({ ok: false, error: expect.stringMatching(/Too many files/) });
  }, 120_000); // 31 reads, each in its own worker
});

describe("importStatement", () => {
  it("stores every row under the signed-in user, never one from the form", async () => {
    const result = await importStatement(form(csv(good), { userId: "attacker", institution: "Test Bank", mask: "1234" }));
    expect(result).toMatchObject({ ok: true, imported: 2 });
    expect(state.documents).toHaveLength(2);
    for (const doc of state.documents) {
      expect(doc.userId).toBe(state.user!.$id);
      expect(doc.hash).toMatch(/^[0-9a-f]{64}$/);
    }
    // The "reuse this bank" lookup is limited to the user's own banks.
    expect(state.listQueries[0].join(" ")).toContain(state.user!.$id);
  });

  it("keeps only the last four digits of the account number", async () => {
    const result = await importStatement(form(csv(good), { mask: "1234 5678 9012 3456" }));
    expect(result).toMatchObject({ ok: true, mask: "3456" });
  });

  it("saves a column layout to the login's preferences, keyed by the auth id", async () => {
    const mapping = { date: 0, name: 1, reference: 2, amount: 3, balance: 4 };
    await importStatement(form(csv(odd), { mapping: JSON.stringify(mapping) }));
    const layouts = state.prefs.statementLayouts as Record<string, unknown>;
    expect(Object.values(layouts)).toEqual([mapping]);
    // The next file of the same shape is read with it automatically.
    expect(await previewStatement(form(csv(odd)))).toMatchObject({ ok: true, source: "saved" });
  });

  it("handles a large but legal statement", async () => {
    const result = await previewStatement(form(new File([new Uint8Array(csvStatement(5_000))], "big.csv")));
    expect(result).toMatchObject({ ok: true, total: 5_000 });
  });
});

describe("entries already saved from another file", () => {
  // The same account, imported before from a file that words things differently.
  const seedSaved = () => {
    state.existingBanks = [{ $id: "bank-1" }];
    state.savedRows = [
      { $id: "s1", bankId: "bank-1", date: "2024-04-01", name: "UPI/DR/531/SWIGGY/SBIN", amount: 640, type: "debit", balance: 1000, hash: "from-the-pdf" },
      {
        $id: "s2",
        bankId: "bank-1",
        date: "2024-04-02",
        name: "NEFT SALARY",
        amount: 5000,
        type: "credit",
        balance: 6000,
        hash: transactionHash("bank-1", { date: "2024-04-02", name: "NEFT SALARY", amount: 5000, type: "credit", balance: 6000 }),
      },
    ];
  };

  it("the preview says what is already there and what only looks like it", async () => {
    seedSaved();
    const result = await previewStatement(form(csv(good), { institution: "Test Bank", mask: "1234" }));
    expect(result).toMatchObject({
      ok: true,
      total: 2,
      alreadySaved: 1,
      likely: { count: 1, rows: [{ date: "2024-04-01", name: "UPI SWIGGY", amount: 640, savedName: "UPI/DR/531/SWIGGY/SBIN" }] },
    });
  });

  it("the import leaves look-alikes out unless the user says they are new", async () => {
    seedSaved();
    expect(await importStatement(form(csv(good), { institution: "Test Bank", mask: "1234" }))).toMatchObject({
      ok: true,
      imported: 0,
      skipped: 1,
      likelySkipped: 1,
    });
    expect(state.documents).toHaveLength(0);

    expect(await importStatement(form(csv(good), { institution: "Test Bank", mask: "1234", keepLikely: "1" }))).toMatchObject({
      ok: true,
      imported: 1,
      likelySkipped: 0,
    });
    expect(state.documents.map((d) => d.name)).toEqual(["UPI SWIGGY"]);
  });

  it("reads every saved entry, past the first page", async () => {
    state.existingBanks = [{ $id: "bank-1" }];
    state.savedRows = Array.from({ length: 250 }, (_, i) => ({ $id: `r${i}`, date: "2024-03-01", name: "OLD", amount: 1, type: "debit", hash: `h${i}` }));
    state.savedRows.push({ $id: "last", date: "2024-04-01", name: "SWIGGY via PDF", amount: 640, type: "debit", balance: 1000, hash: "x" });
    const result = await previewStatement(form(csv(good), { institution: "Test Bank", mask: "1234" }));
    expect(result).toMatchObject({ ok: true, likely: { count: 1 } });
  });

  it("keeps two identical entries in one file instead of dropping the second", async () => {
    const teas = "Date,Narration,Debit,Credit\n01/04/2024,TEA STALL,20.00,\n01/04/2024,TEA STALL,20.00,\n";
    expect(await importStatement(form(csv(teas)))).toMatchObject({ ok: true, imported: 2 });
    const [a, b] = state.documents.map((d) => d.hash);
    expect(a).not.toBe(b);
  });
});

describe("rows that need a look", () => {
  // The refund was read as money out; the balance shows it came in.
  const flipped = "Date,Narration,Debit,Credit,Balance\n01/04/2024,SALARY,,50000.00,50000.00\n02/04/2024,REFUND,400.00,,50400.00\n03/04/2024,TEA,20.00,,50380.00\n";

  it("the preview lists them with the likely fix", async () => {
    const result = await previewStatement(form(csv(flipped)));
    expect(result).toMatchObject({
      ok: true,
      check: { status: "mismatch" },
      doubtful: { count: 1, rows: [{ index: 1, name: "REFUND", reasons: ["balance"], suggestion: { type: "credit" } }] },
    });
  });

  it("reading again with the fix shows the balance adding up", async () => {
    const result = await previewStatement(form(csv(flipped), { fixes: JSON.stringify({ 1: { type: "credit" } }) }));
    expect(result).toMatchObject({ ok: true, check: { status: "ok" }, changed: 1, doubtfulSkipped: 0 });
  });

  it("the import saves the fixed row, or skips it", async () => {
    expect(await importStatement(form(csv(flipped), { fixes: JSON.stringify({ 1: { type: "credit" } }) }))).toMatchObject({ ok: true, imported: 3, changed: 1 });
    expect(state.documents.find((d) => d.name === "REFUND")).toMatchObject({ type: "credit", amount: 400 });

    state.documents = [];
    expect(await importStatement(form(csv(flipped), { skipDoubtful: "1" }))).toMatchObject({ ok: true, imported: 2, doubtfulSkipped: 1 });
    expect(state.documents.map((d) => d.name)).toEqual(["SALARY", "TEA"]);
  });

  it("refuses fixes for rows that were not flagged, and saves nothing", async () => {
    const result = await importStatement(form(csv(flipped), { fixes: JSON.stringify({ 0: { amount: 999999 } }) }));
    expect(result).toMatchObject({ ok: false });
    expect(state.documents).toHaveLength(0);
  });
});
