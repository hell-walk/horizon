import { beforeEach, describe, expect, it, vi } from "vitest";

// The signed-in user owns "acct-mine"; "acct-theirs" belongs to someone else,
// so getAccount (which only returns your own accounts) gives null for it.
const state = vi.hoisted(() => ({
  user: null as null | { $id: string; userId: string },
  prefs: {} as Record<string, unknown>,
  prefWrites: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
// The plan's daily limit has its own tests (plan.test.ts); here every change is allowed.
vi.mock("@/lib/server/plan", () => ({ changeBlocked: async () => null, countChange: async () => {} }));
vi.mock("@/lib/server/auth", () => ({
  getLoggedInUser: async () => state.user,
  ownerIdOf: (u: { $id: string }) => u.$id,
  authIdOf: (u: { userId: string }) => u.userId,
}));
vi.mock("@/lib/server/accounts", () => ({
  getAccountUncached: async ({ appwriteItemId }: { appwriteItemId: string }) =>
    appwriteItemId === "acct-mine" && state.user
      ? {
          data: {},
          transactions: [
            { id: "t1", name: "UPI/DR/531/RAHUL SHARMA/SBIN/rahul@ybl", amount: -15000 },
            { id: "t2", name: "UPI/DR/1/ZOMATO", amount: -300 },
            { id: "t3", name: "UPI/DR/123456789/0001", amount: -50 },
          ],
        }
      : null,
}));
vi.mock("@/lib/server/prefs", () => ({
  readPrefs: async () => JSON.parse(JSON.stringify(state.prefs)),
  updatePrefs: async (_id: string, change: Record<string, unknown>) => {
    state.prefWrites++;
    state.prefs = { ...state.prefs, ...JSON.parse(JSON.stringify(change)) };
    return state.prefs;
  },
}));

const { correctTransaction, undoCorrection } = await import("@/lib/actions/correction.action");

let n = 0;
beforeEach(() => {
  // Fresh ids per test, so the rate limit and the corrections cache never carry over.
  state.user = { $id: `profile-${++n}`, userId: `auth-${n}` };
  state.prefs = { statementLayouts: { sig: { date: 0 } } };
  state.prefWrites = 0;
});

describe("correctTransaction", () => {
  it("needs a session", async () => {
    state.user = null;
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t1", category: "Rent" })).toMatchObject({ ok: false });
    expect(state.prefWrites).toBe(0);
  });

  it("refuses an account that is not yours, and an entry that is not there", async () => {
    expect(await correctTransaction({ accountId: "acct-theirs", transactionId: "t1", category: "Rent" })).toMatchObject({ ok: false });
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "nope", category: "Rent" })).toMatchObject({ ok: false });
    expect(state.prefWrites).toBe(0);
  });

  it("refuses unknown categories, empty changes and wrong shapes", async () => {
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t1", category: "Bribes" })).toMatchObject({ ok: false });
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t1" })).toMatchObject({ ok: false });
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t1", name: "​ " })).toMatchObject({ ok: false });
    // @ts-expect-error: wrong shape on purpose
    expect(await correctTransaction({ accountId: { $ne: 1 }, transactionId: "t1", category: "Rent" })).toMatchObject({ ok: false });
    expect(state.prefWrites).toBe(0);
  });

  it("remembers a change for every entry from the payee, keyed by the server's own reading", async () => {
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t1", name: " Rent ", category: "Rent", everyPayment: true })).toEqual({ ok: true });
    expect(state.prefs).toEqual({
      statementLayouts: { sig: { date: 0 } }, // other preferences are kept
      corrections: { payees: { "rahul sharma": { name: "Rent", category: "Rent" } }, rows: {} },
    });
  });

  it("an entry with no readable payee can only be changed on its own", async () => {
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t3", category: "Food", everyPayment: true })).toEqual({ ok: true });
    expect(state.prefs.corrections).toEqual({ payees: {}, rows: { t3: { category: "Food" } } });
  });

  it("can change one entry only", async () => {
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t2", category: "Health" })).toEqual({ ok: true });
    expect(state.prefs.corrections).toEqual({ payees: {}, rows: { t2: { category: "Health" } } });
  });

  it("stops at the cap instead of growing without end", async () => {
    const rows = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`old${i}`, { category: "Food" }]));
    state.prefs = { corrections: { payees: {}, rows } };
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t2", category: "Health" })).toMatchObject({ ok: false });
    expect(state.prefWrites).toBe(0);
  });
});

describe("reading back", () => {
  it("the page right after a change sees it, even if Appwrite still returns the old copy", async () => {
    expect(await correctTransaction({ accountId: "acct-mine", transactionId: "t2", category: "Health" })).toEqual({ ok: true });
    state.prefs = {}; // what a lagging read would return
    const { loadCorrections } = await import("@/lib/server/corrections");
    expect((await loadCorrections(`profile-${n}`)).rows).toEqual({ t2: { category: "Health" } });
  });
});

describe("undoCorrection", () => {
  it("removes the entry's change and its payee's change", async () => {
    state.prefs = { corrections: { payees: { "rahul sharma": { category: "Rent" }, zomato: { category: "Food" } }, rows: { t1: { name: "x" } } } };
    expect(await undoCorrection({ accountId: "acct-mine", transactionId: "t1" })).toEqual({ ok: true });
    expect(state.prefs.corrections).toEqual({ payees: { zomato: { category: "Food" } }, rows: {} });
  });

  it("refuses someone else's account", async () => {
    expect(await undoCorrection({ accountId: "acct-theirs", transactionId: "t1" })).toMatchObject({ ok: false });
    expect(state.prefWrites).toBe(0);
  });
});
