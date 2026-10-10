import { beforeEach, describe, expect, it, vi } from "vitest";

// One mocked Appwrite for every module, so the real actions and data helpers run on top of it.
const state = vi.hoisted(() => ({
  sessionUser: null as null | Record<string, unknown>,
  profile: null as null | Record<string, unknown>,
  banks: {} as Record<string, Record<string, unknown>>,
  cookies: new Map<string, { value: string; options?: Record<string, unknown> }>(),
  headers: new Map<string, string>(),
  created: [] as Record<string, unknown>[],
  updated: [] as { id: string; data: Record<string, unknown> }[],
  sessionCalls: 0,
  passwordOk: true,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.cookies.has(name) ? { name, value: state.cookies.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => state.cookies.set(name, { value, options }),
    delete: (name: string) => state.cookies.delete(name),
  }),
  headers: async () => ({ get: (name: string) => state.headers.get(name.toLowerCase()) ?? null }),
}));
vi.mock("@/lib/server/appwrite", () => ({
  createSessionClient: async () => ({
    account: {
      get: async () => {
        if (!state.sessionUser) throw new Error("No session");
        return state.sessionUser;
      },
      deleteSession: async () => ({}),
    },
  }),
  createAdminClient: async () => ({
    account: {
      createEmailPasswordSession: async () => {
        state.sessionCalls++;
        if (!state.passwordOk) throw Object.assign(new Error("Invalid credentials"), { code: 401 });
        return { secret: "session-secret", expire: new Date(Date.now() + 365 * 86400_000).toISOString(), userId: "auth-1" };
      },
      create: async (id: string, email: string) => ({ $id: "auth-new", email }),
    },
    database: {
      listDocuments: async (_db: string, _col: string, queries: string[]) => {
        const q = queries.join(" ");
        if (q.includes("userId") && state.profile && q.includes(String(state.profile.userId))) return { documents: [state.profile], total: 1 };
        return { documents: [], total: 0 };
      },
      getDocument: async (_db: string, _col: string, id: string) => {
        if (!state.banks[id]) throw Object.assign(new Error("Document not found"), { code: 404 });
        return state.banks[id];
      },
      createDocument: async (_db: string, _col: string, _id: string, data: Record<string, unknown>) => {
        state.created.push(data);
        return { $id: "doc-new", ...data };
      },
      updateDocument: async (_db: string, _col: string, id: string, data: Record<string, unknown>) => {
        state.updated.push({ id, data });
        return {};
      },
    },
    user: { delete: async () => ({}) },
  }),
}));
vi.mock("@/lib/server/dwolla", () => ({ createDwollaCustomer: vi.fn(async () => undefined), addFundingSource: vi.fn() }));
vi.mock("@/lib/plaid", () => ({
  plaidClient: {
    linkTokenCreate: vi.fn(async () => ({ data: { link_token: "link-sandbox-123" } })),
    itemPublicTokenExchange: vi.fn(),
  },
}));
vi.mock("@/lib/providers/setu", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/setu")>()),
  isSetuConfigured: () => true,
  getConsent: vi.fn(async () => ({ status: "ACTIVE", detail: { accounts: [] } })),
  createConsent: vi.fn(async () => ({ id: "consent-1", url: "https://fiu-sandbox.setu.co/consent/1" })),
}));

const userActions = await import("@/lib/actions/user.action");
const { setCardDesign } = await import("@/lib/actions/card.action");
const { completeSetuConsent, createSetuConsent } = await import("@/lib/actions/setu.action");
const { loadLoggedInUser } = await import("@/lib/server/auth");
const { getOwnBank } = await import("@/lib/server/banks");
const { sealSecret } = await import("@/lib/server/crypto");
const { plaidClient } = await import("@/lib/plaid");

// A fresh profile id per call where asked, so per-user rate limits do not leak between tests.
let fresh = 0;
const signedIn = (profileId = "profile-1") => {
  state.sessionUser = { $id: "auth-1", email: "test@example.com", name: "Test User", prefs: { statementLayouts: {} }, targets: [] };
  state.profile = { $id: profileId, userId: "auth-1", firstName: "Test", ssn: "1234", dateOfBirth: "1990-01-01", dwollaCustomerUrl: "https://x" };
  return profileId;
};
const signedInFresh = () => signedIn(`profile-fresh-${++fresh}`);

let ip = 0;
beforeEach(() => {
  state.sessionUser = null;
  state.profile = null;
  state.banks = {};
  state.cookies.clear();
  state.headers.clear();
  state.headers.set("x-forwarded-for", `198.51.100.${++ip % 250}`);
  state.created = [];
  state.updated = [];
  state.sessionCalls = 0;
  state.passwordOk = true;
});

describe("signIn", () => {
  it("sets an HttpOnly, SameSite=Strict session cookie that expires within 30 days", async () => {
    expect(await userActions.signIn({ email: "a@example.com", password: "pw" })).toEqual({ ok: true });
    const cookie = state.cookies.get("banking-session")!;
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
    const expires = (cookie.options!.expires as Date).getTime();
    expect(expires - Date.now()).toBeLessThanOrEqual(30 * 86400_000 + 1000);
  });

  it("refuses malformed input instead of crashing", async () => {
    for (const input of [undefined, null, "a@b.co", { email: 1, password: "x" }, { email: "a@b.co" }, { email: "a".repeat(300), password: "x" }]) {
      // @ts-expect-error: wrong shapes on purpose
      expect(await userActions.signIn(input)).toEqual({ ok: false, error: "Check the details and try again." });
    }
    // @ts-expect-error: wrong shape on purpose
    expect(await userActions.signUp({ email: "a@b.co", password: "x" })).toEqual({ ok: false, error: "Check the details and try again." });
    expect(state.sessionCalls).toBe(0);
  });

  it("gives the same message for a wrong password and returns no user data", async () => {
    state.passwordOk = false;
    const result = await userActions.signIn({ email: "b@example.com", password: "wrong" });
    expect(result).toEqual({ ok: false, error: "Invalid email or password." });
    expect(state.cookies.has("banking-session")).toBe(false);
  });

  it("stops password guessing on one email after 8 tries, without asking Appwrite again", async () => {
    state.passwordOk = false;
    const email = `victim-${Math.random()}@example.com`;
    for (let i = 0; i < 8; i++) {
      state.headers.set("x-forwarded-for", `203.0.113.${i}`); // even from different IPs
      await userActions.signIn({ email, password: `guess-${i}` });
    }
    const callsBefore = state.sessionCalls;
    const ninth = await userActions.signIn({ email: email.toUpperCase(), password: "guess-9" }); // case does not help
    expect(ninth).toEqual({ ok: false, error: expect.stringMatching(/Too many attempts/) });
    expect(state.sessionCalls).toBe(callsBefore);
  });

  it("never locks out a user for signing in successfully many times", async () => {
    const email = `busy-${Math.random()}@example.com`;
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await userActions.signIn({ email, password: "right" }));
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("stops one IP spraying many accounts after 100 tries", async () => {
    state.headers.set("x-forwarded-for", "192.0.2.77");
    const results = [];
    for (let i = 0; i < 101; i++) results.push(await userActions.signIn({ email: `spray-${i}@example.com`, password: "pw" }));
    expect(results[99]).toEqual({ ok: true });
    expect(results[100]).toEqual({ ok: false, error: expect.stringMatching(/Too many attempts/) });
  });
});

describe("signUp", () => {
  it("does not store the SSN or date of birth and returns no personal data", async () => {
    const result = await userActions.signUp({
      firstName: "Ada",
      lastName: "Lovelace",
      address1: "1 Main St",
      city: "Pune",
      state: "MH",
      postalCode: "411001",
      dateOfBirth: "1990-01-01",
      ssn: "123456789",
      email: `new-${Math.random()}@example.com`,
      password: "Str0ng!Passw0rd",
    });
    expect(result.ok).toBe(true);
    const profile = state.created.find((d) => "firstName" in d)!;
    expect(profile.ssn).toBe("not-kept");
    expect(profile.dateOfBirth).toBe("not-kept");
    expect(JSON.stringify(result)).not.toMatch(/123456789|1990-01-01|1 Main St/);
  });
});

describe("password policy (enforced on the server, not just the form)", () => {
  const base = { firstName: "Ada", lastName: "L", address1: "1 Main St", city: "Pune", state: "MH", postalCode: "411001", dateOfBirth: "1990-01-01", ssn: "1234" };

  it.each([
    ["short", "Use at least 8 characters."],
    ["x".repeat(129), "Use at most 128 characters."],
    ["password123", "That password is too common. Choose another."],
    ["aaaaaaaaaa", "That password is too common. Choose another."],
    ["adalovelace!2026", "Do not use your email in your password."],
  ])("refuses %j", async (password, error) => {
    expect(await userActions.signUp({ ...base, email: `adalovelace-${Math.random()}@example.com`.replace(/-[\d.]+@/, "@"), password })).toEqual({ ok: false, error });
  });

  it.each(["Str0ng!Passw0rd", "correct horse battery staple", "ab12CD34ef"])("accepts %j", async (password) => {
    expect(await userActions.signUp({ ...base, email: `user-${Math.random()}@example.com`, password })).toMatchObject({ ok: true });
  });
});

describe("the signed-in user handed to pages", () => {
  it("never carries SSN, date of birth, preferences or the Dwolla URL", async () => {
    signedIn();
    const user = (await loadLoggedInUser()) as unknown as Record<string, unknown>;
    expect(user).toMatchObject({ $id: "profile-1", userId: "auth-1", email: "test@example.com" });
    for (const field of ["ssn", "dateOfBirth", "prefs", "targets", "dwollaCustomerUrl"]) expect(user, field).not.toHaveProperty(field);
  });
});

describe("Plaid actions take the user from the session only", () => {
  it("createLinkToken refuses without a session", async () => {
    expect(await userActions.createLinkToken()).toBeNull();
    expect(plaidClient.linkTokenCreate).not.toHaveBeenCalled();
  });

  it("exchangePublicToken refuses without a session or with a non-string token", async () => {
    expect(await userActions.exchangePublicToken({ publicToken: "public-sandbox-1" })).toBeNull();
    signedIn();
    // @ts-expect-error: wrong type on purpose
    expect(await userActions.exchangePublicToken({ publicToken: { $ne: null } })).toBeNull();
    expect(plaidClient.itemPublicTokenExchange).not.toHaveBeenCalled();
  });
});

describe("bank ownership", () => {
  beforeEach(() => {
    state.banks = {
      mine: { $id: "mine", userId: "profile-1", accessToken: sealSecret("access-sandbox-mine") },
      theirs: { $id: "theirs", userId: "profile-2", accessToken: sealSecret("access-sandbox-theirs") },
    };
  });

  it("getOwnBank returns the user's bank with its token opened", async () => {
    expect(await getOwnBank("profile-1", "mine")).toMatchObject({ $id: "mine", accessToken: "access-sandbox-mine" });
  });

  it("getOwnBank returns nothing for someone else's bank or a missing one", async () => {
    expect(await getOwnBank("profile-1", "theirs")).toBeNull();
    expect(await getOwnBank("profile-1", "missing")).toBeNull();
    expect(await getOwnBank("profile-1", "")).toBeNull();
  });

  it("setCardDesign refuses someone else's card and unknown designs", async () => {
    signedIn();
    expect(await setCardDesign({ appwriteItemId: "theirs", design: "auto" })).toMatchObject({ ok: false, error: "That account is not yours." });
    expect(await setCardDesign({ appwriteItemId: "mine", design: "<img onerror=alert(1)>" })).toMatchObject({ ok: false });
    expect(state.updated).toEqual([]);
    expect(await setCardDesign({ appwriteItemId: "mine", design: "auto" })).toEqual({ ok: true });
    expect(state.updated).toEqual([{ id: "mine", data: { cardDesign: "auto" } }]);
  });

  it("setCardDesign refuses without a session", async () => {
    expect(await setCardDesign({ appwriteItemId: "mine", design: "auto" })).toMatchObject({ ok: false });
  });
});

describe("Setu consent", () => {
  it("createSetuConsent requires a session and a valid mobile number", async () => {
    expect(await createSetuConsent({ mobile: "9876543210" })).toEqual({ error: "You need to be signed in." });
    signedInFresh();
    expect(await createSetuConsent({ mobile: "98765; DROP TABLE" })).toMatchObject({ error: expect.stringMatching(/10-digit/) });
    // @ts-expect-error: wrong type on purpose
    expect(await createSetuConsent({ mobile: { length: 10 } })).toMatchObject({ error: expect.any(String) });
    const ok = await createSetuConsent({ mobile: "9876543210" });
    expect(ok).toMatchObject({ consentId: "consent-1" });
    expect(state.cookies.get("setu-consent")?.options).toMatchObject({ httpOnly: true });
  });

  it("only completes the consent this user started in this browser", async () => {
    signedInFresh();
    expect(await completeSetuConsent({ consentId: "consent-1" })).toMatchObject({ status: "MISSING" }); // nothing started
    await createSetuConsent({ mobile: "9876543210" });
    expect(await completeSetuConsent({ consentId: "someone-elses-consent" })).toMatchObject({ status: "MISSING" });
    expect(await completeSetuConsent({ consentId: "consent-1" })).toMatchObject({ status: "ACTIVE" });
  });

  it("the pending cookie is sealed: a hand-made one is ignored", async () => {
    const me = signedInFresh();
    await createSetuConsent({ mobile: "9876543210" });
    const value = state.cookies.get("setu-consent")!.value;
    expect(value).not.toContain("consent-1");
    expect(value).not.toContain(me);
    for (const forged of ["consent-1", JSON.stringify({ ownerId: me, consentId: "consent-1" }), value.slice(0, -4) + "AAAA"]) {
      state.cookies.set("setu-consent", { value: forged });
      expect(await completeSetuConsent({ consentId: "consent-1" }), forged.slice(0, 20)).toMatchObject({ status: "MISSING" });
    }
  });

  it("on a shared browser, the next person to sign in cannot finish someone else's consent", async () => {
    signedIn(); // A starts linking a bank...
    await createSetuConsent({ mobile: "9876543210" });
    // ...and B signs in on the same browser, with A's pending cookie still there.
    state.sessionUser = { $id: "auth-2", email: "b@example.com", name: "B" };
    state.profile = { $id: "profile-2", userId: "auth-2", firstName: "B" };
    expect(await completeSetuConsent({ consentId: "consent-1" })).toMatchObject({ status: "MISSING" });
    expect(await completeSetuConsent({})).toMatchObject({ status: "MISSING" });
  });

  it("signing out clears a half-finished bank link", async () => {
    signedInFresh();
    await createSetuConsent({ mobile: "9876543210" });
    expect(state.cookies.has("setu-consent")).toBe(true);
    await userActions.logoutAccount();
    expect(state.cookies.has("setu-consent")).toBe(false);
    expect(state.cookies.has("banking-session")).toBe(false);
  });

  it("does nothing without a session", async () => {
    signedInFresh();
    await createSetuConsent({ mobile: "9876543210" });
    state.sessionUser = null;
    expect(await completeSetuConsent({ consentId: "consent-1" })).toMatchObject({ status: "MISSING" });
  });
});

describe("limits on actions that call paid providers", () => {
  it("createLinkToken stops after 20 Plaid calls in 10 minutes", async () => {
    signedInFresh();
    vi.mocked(plaidClient.linkTokenCreate).mockClear();
    const results = [];
    for (let i = 0; i < 22; i++) results.push(await userActions.createLinkToken());
    expect(results.slice(0, 20).every((r) => r?.linkToken)).toBe(true);
    expect(results.slice(20)).toEqual([null, null]);
    expect(plaidClient.linkTokenCreate).toHaveBeenCalledTimes(20);
  });

  it("exchangePublicToken stops after 10 calls and refuses oversized tokens", async () => {
    signedInFresh();
    vi.mocked(plaidClient.itemPublicTokenExchange).mockClear();
    expect(await userActions.exchangePublicToken({ publicToken: "p".repeat(500) })).toBeNull();
    for (let i = 0; i < 12; i++) await userActions.exchangePublicToken({ publicToken: `public-sandbox-${i}` });
    expect(plaidClient.itemPublicTokenExchange).toHaveBeenCalledTimes(10);
  });

  it("setCardDesign stops after 60 changes in 10 minutes", async () => {
    const me = signedInFresh();
    state.banks = { mine: { $id: "mine", userId: me, accessToken: "x" } };
    const results = [];
    for (let i = 0; i < 61; i++) results.push(await setCardDesign({ appwriteItemId: "mine", design: "auto" }));
    expect(results[59]).toEqual({ ok: true });
    expect(results[60]).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });
});
