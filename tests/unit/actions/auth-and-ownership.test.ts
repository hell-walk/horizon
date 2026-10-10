import { beforeEach, describe, expect, it, vi } from "vitest";

// One mocked Appwrite and one mocked Supabase for every module, so the real
// actions, data helpers and cookie rules (server/supabase.ts) run on top of them.
const state = vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://horizon.test";
  return {
    sessionUser: null as null | Record<string, unknown>,
    profile: null as null | Record<string, unknown>,
    banks: {} as Record<string, Record<string, unknown>>,
    cookies: new Map<string, { value: string; options?: Record<string, unknown> }>(),
    headers: new Map<string, string>(),
    created: [] as Record<string, unknown>[],
    updated: [] as { id: string; data: Record<string, unknown> }[],
    deletedDocs: [] as string[],
    failProfile: false,
    sessionCalls: 0,
    passwordOk: true,
    newLogins: [] as Record<string, unknown>[],
    deletedLogins: [] as string[],
    oauth: [] as Record<string, unknown>[],
    resets: [] as { email: string; options: Record<string, unknown> }[],
    passwordUpdates: [] as string[],
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.cookies.has(name) ? { name, value: state.cookies.get(name)!.value } : undefined),
    getAll: () => [...state.cookies].map(([name, c]) => ({ name, value: c.value })),
    set: (name: string, value: string, options?: Record<string, unknown>) => state.cookies.set(name, { value, options }),
    delete: (name: string) => state.cookies.delete(name),
  }),
  headers: async () => ({ get: (name: string) => state.headers.get(name.toLowerCase()) ?? null }),
}));

type SetAll = (list: { name: string; value: string; options: Record<string, unknown> }[], headers: Record<string, string>) => void;
// Supabase's cookie client. What it asks for (400 days, readable by scripts) is
// what the library really asks for; server/supabase.ts must override it.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: SetAll } }) => ({
    auth: {
      getUser: async () =>
        state.sessionUser ? { data: { user: state.sessionUser }, error: null } : { data: { user: null }, error: Object.assign(new Error("Auth session missing"), { status: 401 }) },
      signInWithPassword: async () => {
        state.sessionCalls++;
        if (!state.passwordOk) return { data: {}, error: Object.assign(new Error("Invalid login credentials"), { status: 400 }) };
        options.cookies.setAll([{ name: "horizon-session", value: "base64-token", options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * 86400 } }], {});
        return { data: { session: {} }, error: null };
      },
      signOut: async () => {
        options.cookies.setAll([{ name: "horizon-session", value: "", options: { path: "/", maxAge: 0 } }], {});
        return { error: null };
      },
      signInWithOAuth: async (args: Record<string, unknown>) => {
        state.oauth.push(args);
        return { data: { url: "https://supabase.test/auth/v1/authorize?provider=google" }, error: null };
      },
      resetPasswordForEmail: async (email: string, opts: Record<string, unknown>) => {
        state.resets.push({ email, options: opts });
        return { data: {}, error: null };
      },
      updateUser: async ({ password }: { password: string }) => {
        state.passwordUpdates.push(password);
        return { data: {}, error: null };
      },
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: async (attrs: Record<string, unknown>) => {
          state.newLogins.push(attrs);
          return { data: { user: { id: "auth-new", email: attrs.email } }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deletedLogins.push(id);
          return { data: {}, error: null };
        },
        signOut: async () => ({ error: null }),
      },
    },
  }),
}));
vi.mock("@/lib/server/appwrite", () => ({
  createAdminClient: async () => ({
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
        if (state.failProfile) throw new Error("Appwrite is down");
        state.created.push(data);
        return { $id: "doc-new", ...data };
      },
      updateDocument: async (_db: string, _col: string, id: string, data: Record<string, unknown>) => {
        state.updated.push({ id, data });
        return {};
      },
      deleteDocument: async (_db: string, _col: string, id: string) => state.deletedDocs.push(id),
    },
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
const { loadLoggedInUser, loadSession } = await import("@/lib/server/auth");
const { getOwnBank } = await import("@/lib/server/banks");
const { sealSecret } = await import("@/lib/server/crypto");
const { plaidClient } = await import("@/lib/plaid");

// A fresh profile id per call where asked, so per-user rate limits do not leak between tests.
let fresh = 0;
const login = (id: string, email: string, providers = ["email"]) => ({
  id,
  email,
  // Subscribed, so the trial's 3 changes a day stay out of these tests (plan.test.ts covers them).
  app_metadata: { provider: providers[0], providers, subscription: { id: "sub_test", period: "monthly", status: "active", until: Date.now() + 30 * 86400_000 } },
  user_metadata: { full_name: "Test User" },
  last_sign_in_at: new Date().toISOString(),
});
const signedIn = (profileId = "profile-1") => {
  state.sessionUser = login("auth-1", "test@example.com");
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
  state.deletedDocs = [];
  state.failProfile = false;
  state.sessionCalls = 0;
  state.passwordOk = true;
  state.newLogins = [];
  state.deletedLogins = [];
  state.oauth = [];
  state.resets = [];
  state.passwordUpdates = [];
});

describe("signIn", () => {
  it("sets an HttpOnly, SameSite=Lax session cookie that lasts at most 30 days", async () => {
    expect(await userActions.signIn({ email: "a@example.com", password: "pw" })).toEqual({ ok: true });
    // Supabase asks for a 400-day cookie that scripts can read; Horizon refuses both.
    const cookie = state.cookies.get("horizon-session")!;
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie.options!.maxAge).toBeLessThanOrEqual(30 * 86400);
  });

  it("signing out really removes the cookie (age 0 is kept, not raised to 30 days)", async () => {
    signedIn();
    state.cookies.set("horizon-session", { value: "base64-token" });
    state.cookies.set("horizon-session.1", { value: "second-piece" });
    await userActions.logoutAccount();
    expect([...state.cookies.keys()].filter((n) => n.startsWith("horizon-session"))).toEqual([]);
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
    expect(state.cookies.has("horizon-session")).toBe(false);
  });

  it("stops password guessing on one email after 8 tries, without asking Supabase again", async () => {
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
      country: "IN",
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
    expect(profile.userId).toBe("auth-new"); // linked to the Supabase login
    expect(JSON.stringify(result)).not.toMatch(/123456789|1990-01-01|1 Main St/);
    // Created as confirmed: Horizon sends no confirmation email.
    expect(state.newLogins.at(-1)).toMatchObject({ email_confirm: true });
  });

  it("rolls back the login when the profile cannot be saved, so the email can try again", async () => {
    state.failProfile = true;
    const result = await userActions.signUp({
      country: "IN", firstName: "Ada", lastName: "Lovelace", address1: "1 Main St", city: "Pune", state: "MH", postalCode: "411001",
      dateOfBirth: "", ssn: "", email: `rollback-${Math.random()}@example.com`, password: "Str0ng!Passw0rd",
    });
    expect(result).toMatchObject({ ok: false });
    expect(state.deletedLogins).toEqual(["auth-new"]);
    expect(state.cookies.has("horizon-session")).toBe(false);
  });
});

describe("sign-up by country", () => {
  const person = (extra: Record<string, string>) => ({
    firstName: "Ada",
    lastName: "Lovelace",
    address1: "1 Main Street",
    city: "Town",
    state: "",
    postalCode: "",
    dateOfBirth: "",
    ssn: "",
    email: `country-${Math.random()}@example.com`,
    password: "Str0ng!Passw0rd",
    ...extra,
  }) as SignUpParams;

  it("India: state and PIN, no date of birth or SSN, and nothing goes to the US payment partner", async () => {
    const { createDwollaCustomer } = await import("@/lib/server/dwolla");
    vi.mocked(createDwollaCustomer).mockClear();
    expect(await userActions.signUp(person({ country: "IN", state: "MH", postalCode: "411001" }))).toMatchObject({ ok: true });
    expect(createDwollaCustomer).not.toHaveBeenCalled();
    expect(JSON.parse(String(state.created.at(-1)?.prefs))).toEqual({ country: "IN" });
  });

  it("UK: no region needed, a postal code if given", async () => {
    expect(await userActions.signUp(person({ country: "GB" }))).toMatchObject({ ok: true });
    expect(await userActions.signUp(person({ country: "GB", postalCode: "SW1A 1AA" }))).toMatchObject({ ok: true });
    expect(await userActions.signUp(person({ country: "AE" }))).toMatchObject({ ok: true }); // no postal codes there
  });

  it("India and the US need their state and postal code", async () => {
    expect(await userActions.signUp(person({ country: "IN" }))).toMatchObject({ ok: false });
  });

  it("US: a US address, date of birth and SSN, all three", async () => {
    const us = { country: "US", state: "NY", postalCode: "10001" };
    expect(await userActions.signUp(person(us))).toMatchObject({ ok: false }); // no SSN or date of birth
    expect(await userActions.signUp(person({ ...us, dateOfBirth: "1990-01-01" }))).toMatchObject({ ok: false });
    expect(await userActions.signUp(person({ ...us, state: "MH", postalCode: "411001", dateOfBirth: "1990-01-01", ssn: "1234" }))).toMatchObject({ ok: false });
    expect(await userActions.signUp(person({ ...us, dateOfBirth: "1990-01-01", ssn: "1234" }))).toMatchObject({ ok: true });
  });

  it("refuses a country that does not exist, or none", async () => {
    expect(await userActions.signUp(person({ country: "XX" }))).toMatchObject({ ok: false });
    expect(await userActions.signUp(person({ country: "" }))).toMatchObject({ ok: false });
  });
});

describe("password policy (enforced on the server, not just the form)", () => {
  const base = { country: "IN", firstName: "Ada", lastName: "Lo", address1: "1 Main St", city: "Pune", state: "MH", postalCode: "411001", dateOfBirth: "", ssn: "" };

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

describe("Continue with Google", () => {
  it("sends Google back to this site's own address, from the configuration", async () => {
    state.headers.set("host", "evil.example"); // a forged Host header changes nothing
    expect(await userActions.signInWithGoogle()).toEqual({ ok: true, url: expect.stringMatching(/^https:\/\/supabase\.test\//) });
    expect(state.oauth.at(-1)).toMatchObject({ provider: "google", options: { redirectTo: "https://horizon.test/auth/callback", skipBrowserRedirect: true } });
  });

  it("a Google login without a profile is not a signed-in user yet", async () => {
    state.sessionUser = login("auth-g", "g@example.com", ["google"]);
    expect(await loadLoggedInUser()).toBeNull();
    expect(await loadSession()).toMatchObject({ id: "auth-g", email: "g@example.com", hasPassword: false });
  });
});

describe("finishing the profile (first Google sign-in)", () => {
  const details = { country: "IN", firstName: "Grace", lastName: "Hopper", address1: "2 Ring Road", city: "Delhi", state: "DL", postalCode: "110001", dateOfBirth: "", ssn: "", terms: true };

  it("needs a session, the terms, and the same details as sign-up", async () => {
    expect(await userActions.completeProfile(details)).toMatchObject({ ok: false });
    state.sessionUser = login(`auth-g-${++fresh}`, "g@example.com", ["google"]);
    expect(await userActions.completeProfile({ ...details, terms: false })).toMatchObject({ ok: false });
    expect(await userActions.completeProfile({ ...details, country: "XX" })).toMatchObject({ ok: false });
    expect(await userActions.completeProfile({ ...details, state: "" })).toMatchObject({ ok: false });
    expect(state.created).toEqual([]);
  });

  it("creates the profile with the login's email, not one the caller sends", async () => {
    const id = `auth-g-${++fresh}`;
    state.sessionUser = login(id, "g@example.com", ["google"]);
    // @ts-expect-error: an extra field on purpose
    expect(await userActions.completeProfile({ ...details, email: "someone@else.com", userId: "auth-victim" })).toMatchObject({ ok: true });
    expect(state.created.at(-1)).toMatchObject({ email: "g@example.com", userId: id, ssn: "not-kept", dateOfBirth: "not-kept" });
  });

  it("never makes a second profile for the same login", async () => {
    const id = `auth-g-${++fresh}`;
    state.sessionUser = login(id, "g@example.com", ["google"]);
    state.profile = { $id: "profile-g", userId: id, firstName: "Grace" };
    expect(await userActions.completeProfile(details)).toEqual({ ok: true });
    expect(state.created).toEqual([]);
  });
});

describe("forgot password", () => {
  it("answers the same whether or not the email has an account, and links back to this site", async () => {
    expect(await userActions.requestPasswordReset({ email: "nobody@example.com" })).toEqual({ ok: true });
    expect(await userActions.requestPasswordReset({ email: "test@example.com" })).toEqual({ ok: true });
    expect(state.resets.at(-1)?.options).toEqual({ redirectTo: "https://horizon.test/auth/callback?next=/reset-password" });
  });

  it("sends at most 3 emails an hour to one address, and still answers the same", async () => {
    const email = `flood-${Math.random()}@example.com`;
    for (let i = 0; i < 5; i++) expect(await userActions.requestPasswordReset({ email })).toEqual({ ok: true });
    expect(state.resets.filter((r) => r.email === email)).toHaveLength(3);
  });

  it("refuses things that are not an email", async () => {
    // @ts-expect-error: wrong shape on purpose
    expect(await userActions.requestPasswordReset({ email: { $ne: "" } })).toMatchObject({ ok: false });
    expect(await userActions.requestPasswordReset({ email: "not an email" })).toMatchObject({ ok: false });
    expect(state.resets).toEqual([]);
  });

  it("the new password needs the link's session and follows the password rules", async () => {
    expect(await userActions.setNewPassword({ password: "Str0ng!Passw0rd" })).toMatchObject({ ok: false });
    state.sessionUser = login(`auth-r-${++fresh}`, "reset@example.com");
    expect(await userActions.setNewPassword({ password: "password123" })).toMatchObject({ ok: false });
    expect(state.passwordUpdates).toEqual([]);
    expect(await userActions.setNewPassword({ password: "Str0ng!Passw0rd" })).toEqual({ ok: true });
    expect(state.passwordUpdates).toEqual(["Str0ng!Passw0rd"]);
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
    state.sessionUser = login("auth-2", "b@example.com");
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
    expect(state.cookies.has("horizon-session")).toBe(false);
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
