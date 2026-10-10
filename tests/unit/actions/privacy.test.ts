import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory Appwrite with two users: "me" (profile p-me, auth a-me) and "them".
type Doc = Record<string, unknown> & { $id: string };
const db = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
  cookies: new Map<string, string>(),
  sessionUser: null as null | Record<string, unknown>,
  deletedAuthUsers: [] as string[],
  deletedSessions: [] as string[],
  passwordOk: true,
}));
const calls = vi.hoisted(() => ({ itemRemove: [] as string[], removeFundingSource: [] as string[], deactivate: [] as string[] }));

const COL = { users: "users", banks: "banks", tx: "transactions", st: "statements" };
vi.stubEnv("APPWRITE_DATABASE_ID", "db");
vi.stubEnv("APPWRITE_USER_COLLECTION_ID", COL.users);
vi.stubEnv("APPWRITE_BANK_COLLECTION_ID", COL.banks);
vi.stubEnv("APPWRITE_TRANSACTION_COLLECTION_ID", COL.tx);
vi.stubEnv("APPWRITE_STATEMENT_COLLECTION_ID", COL.st);

const col = (name: string) => {
  if (!db.collections.has(name)) db.collections.set(name, new Map());
  return db.collections.get(name)!;
};
const matches = (doc: Record<string, unknown>, queries: string[]) =>
  queries.every((q) => {
    const { method, attribute, values } = JSON.parse(q) as { method: string; attribute: string; values: unknown[] };
    return method !== "equal" || values.includes(doc[attribute]);
  });

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (db.cookies.has(n) ? { value: db.cookies.get(n) } : undefined), set: vi.fn(), delete: (n: string) => db.cookies.delete(n) }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/lib/plaid", () => ({ plaidClient: { itemRemove: vi.fn(async ({ access_token }: { access_token: string }) => calls.itemRemove.push(access_token)) } }));
vi.mock("@/lib/server/dwolla", () => ({
  removeFundingSource: vi.fn(async (url: string) => calls.removeFundingSource.push(url)),
  deactivateCustomer: vi.fn(async (url: string) => calls.deactivate.push(url)),
}));
vi.mock("@/lib/server/appwrite", () => ({
  createSessionClient: async () => ({
    account: {
      get: async () => {
        if (!db.sessionUser) throw new Error("No session");
        return db.sessionUser;
      },
    },
  }),
  createAdminClient: async () => ({
    account: {
      createEmailPasswordSession: async () => {
        if (!db.passwordOk) throw Object.assign(new Error("Invalid credentials"), { code: 401 });
        return { $id: "extra-session", secret: "x" };
      },
    },
    database: {
      listDocuments: async (_db: string, c: string, queries: string[]) => {
        const limit = queries.map((q) => JSON.parse(q)).find((q) => q.method === "limit")?.values?.[0] ?? 25;
        const after = queries.map((q) => JSON.parse(q)).find((q) => q.method === "cursorAfter")?.values?.[0];
        let docs = [...col(c).entries()].map(([$id, d]) => ({ $id, ...d }) as Doc).filter((d) => matches(d, queries));
        if (after) docs = docs.slice(docs.findIndex((d) => d.$id === after) + 1);
        return { documents: docs.slice(0, limit), total: docs.length };
      },
      getDocument: async (_db: string, c: string, id: string) => {
        const d = col(c).get(id);
        if (!d) throw Object.assign(new Error("Document not found"), { code: 404 });
        return { $id: id, ...d };
      },
      updateDocument: async (_db: string, c: string, id: string, data: Record<string, unknown>) => col(c).set(id, { ...col(c).get(id), ...data }),
      deleteDocument: async (_db: string, c: string, id: string) => col(c).delete(id),
    },
    user: {
      delete: async (id: string) => db.deletedAuthUsers.push(id),
      deleteSession: async (_u: string, s: string) => db.deletedSessions.push(s),
    },
  }),
}));

const { deleteBank, deleteMyAccount, exportMyData } = await import("@/lib/actions/privacy.action");

const seed = () => {
  db.collections.clear();
  db.cookies.clear();
  db.deletedAuthUsers = [];
  db.deletedSessions = [];
  db.passwordOk = true;
  calls.itemRemove = [];
  calls.removeFundingSource = [];
  calls.deactivate = [];
  db.sessionUser = { $id: "a-me", email: "me@example.com", name: "Me" };
  col(COL.users).set("p-me", { userId: "a-me", prefs: JSON.stringify({ statementLayouts: { sig: { date: 0 } } }), firstName: "Me", lastName: "Self", address1: "1 Road", city: "Pune", state: "MH", postalCode: "411001", ssn: "not-kept", dateOfBirth: "not-kept", dwollaCustomerUrl: "https://dwolla/customers/me" });
  col(COL.users).set("p-them", { userId: "a-them", firstName: "Them", lastName: "Other" });
  col(COL.banks).set("bank-mine", { userId: "p-me", provider: "plaid", accessToken: "access-sandbox-mine-123", fundingSourceUrl: "https://dwolla/fs/mine", institutionName: "HDFC Bank", accountMask: "4821", sharableId: "s1" });
  col(COL.banks).set("bank-mine-2", { userId: "p-me", provider: "manual", accessToken: "manual", institutionName: "SBI", accountMask: "1111", sharableId: "s2" });
  col(COL.banks).set("bank-theirs", { userId: "p-them", provider: "manual", accessToken: "manual", institutionName: "Axis", accountMask: "9999", sharableId: "s3" });
  for (let i = 0; i < 130; i++) col(COL.st).set(`st-mine-${i}`, { bankId: "bank-mine", userId: "p-me", date: "2026-01-01", name: `ROW ${i}`, amount: 1, type: "debit" });
  col(COL.st).set("st-mine2", { bankId: "bank-mine-2", userId: "p-me", date: "2026-01-02", name: "SBI ROW", amount: 2, type: "credit" });
  col(COL.st).set("st-theirs", { bankId: "bank-theirs", userId: "p-them", date: "2026-01-03", name: "THEIR SECRET", amount: 3, type: "debit" });
  col(COL.tx).set("tx-sent", { senderId: "p-me", receiverId: "p-them", email: "them@example.com", amount: "10", name: "dinner" });
  col(COL.tx).set("tx-received", { senderId: "p-them", receiverId: "p-me", email: "me@example.com", amount: "5", name: "refund" });
};

beforeEach(seed);
let n = 0;
const freshUser = () => {
  // Rate limits are per user and per process: give every test its own profile id.
  const id = `p-me-${++n}`;
  for (const [key, bank] of col(COL.banks)) if (bank.userId === "p-me") col(COL.banks).set(key, { ...bank, userId: id });
  for (const [key, row] of col(COL.st)) if (row.userId === "p-me") col(COL.st).set(key, { ...row, userId: id });
  for (const [key, t] of col(COL.tx)) col(COL.tx).set(key, { ...t, senderId: t.senderId === "p-me" ? id : t.senderId, receiverId: t.receiverId === "p-me" ? id : t.receiverId });
  const profile = col(COL.users).get("p-me")!;
  col(COL.users).delete("p-me");
  col(COL.users).set(id, profile);
  return id;
};

describe("deleteBank", () => {
  it("needs a session", async () => {
    db.sessionUser = null;
    expect(await deleteBank({ appwriteItemId: "bank-mine" })).toMatchObject({ ok: false });
    expect(col(COL.banks).has("bank-mine")).toBe(true);
  });

  it("refuses someone else's bank and touches nothing", async () => {
    freshUser();
    expect(await deleteBank({ appwriteItemId: "bank-theirs" })).toEqual({ ok: false, error: "That bank is not on your account." });
    expect(col(COL.banks).has("bank-theirs")).toBe(true);
    expect(col(COL.st).has("st-theirs")).toBe(true);
  });

  it("removes my bank, all its entries (across pages) and its provider links, and nothing else", async () => {
    freshUser();
    expect(await deleteBank({ appwriteItemId: "bank-mine" })).toEqual({ ok: true });
    expect(col(COL.banks).has("bank-mine")).toBe(false);
    expect([...col(COL.st).keys()].filter((k) => k.startsWith("st-mine-"))).toEqual([]); // all 130
    expect(col(COL.st).has("st-mine2")).toBe(true); // my other bank keeps its rows
    expect(col(COL.st).has("st-theirs")).toBe(true);
    expect(calls.itemRemove).toEqual(["access-sandbox-mine-123"]);
    expect(calls.removeFundingSource).toEqual(["https://dwolla/fs/mine"]);
    expect(col(COL.tx).size).toBe(2); // transfers are the other person's history too
  });
});

describe("exportMyData", () => {
  it("needs a session", async () => {
    db.sessionUser = null;
    expect(await exportMyData()).toMatchObject({ ok: false });
  });

  it("contains my data, nobody else's, and no secrets", async () => {
    freshUser();
    const result = await exportMyData();
    expect(result.ok).toBe(true);
    const json = result.ok ? result.json : "";
    const data = JSON.parse(json);
    expect(data.profile).toMatchObject({ email: "me@example.com", firstName: "Me" });
    expect(data.accounts.map((a: { bank: string }) => a.bank).sort()).toEqual(["HDFC Bank", "SBI"]);
    expect(data.accounts.find((a: { bank: string }) => a.bank === "HDFC Bank").statementEntries).toHaveLength(130);
    expect(data.transfers).toHaveLength(2);
    for (const secret of ["access-sandbox", "dwolla", "ssn", "dateOfBirth", "THEIR SECRET", "Axis", "accessToken", "fundingSource", "sharableId"]) {
      expect(json, secret).not.toContain(secret);
    }
  });
});

describe("deleteMyAccount", () => {
  it("needs the right password and deletes nothing otherwise", async () => {
    freshUser();
    db.passwordOk = false;
    expect(await deleteMyAccount({ password: "wrong" })).toEqual({ ok: false, error: "That password is not right." });
    expect(await deleteMyAccount({ password: "" })).toMatchObject({ ok: false });
    // @ts-expect-error: wrong shape on purpose
    expect(await deleteMyAccount({ password: { $ne: 1 } })).toMatchObject({ ok: false });
    expect(col(COL.banks).size).toBe(3);
    expect(db.deletedAuthUsers).toEqual([]);
  });

  it("removes everything of mine, anonymises my side of transfers, and leaves the other user alone", async () => {
    const me = freshUser();
    db.cookies.set("banking-session", "s").set("horizon-account", "bank-mine").set("setu-consent", "x");
    expect(await deleteMyAccount({ password: "right" })).toEqual({ ok: true });

    expect([...col(COL.banks).keys()]).toEqual(["bank-theirs"]);
    expect([...col(COL.st).keys()]).toEqual(["st-theirs"]);
    expect(col(COL.users).has(me)).toBe(false);
    expect(col(COL.users).has("p-them")).toBe(true);

    expect(col(COL.tx).get("tx-sent")).toMatchObject({ senderId: "deleted-user", receiverId: "p-them", email: "them@example.com" });
    expect(col(COL.tx).get("tx-received")).toMatchObject({ senderId: "p-them", receiverId: "deleted-user", email: "deleted-user" });

    expect(calls.deactivate).toEqual(["https://dwolla/customers/me"]);
    expect(db.deletedAuthUsers).toEqual(["a-me"]);
    expect(db.deletedSessions).toEqual(["extra-session"]); // the password check's own session
    expect([...db.cookies.keys()]).toEqual([]);
  });
});
