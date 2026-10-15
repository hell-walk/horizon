import { beforeEach, describe, expect, it, vi } from "vitest";

// The rules for promo and referral codes, on a fake Appwrite table and fake Supabase logins.
const state = vi.hoisted(() => {
  process.env.APPWRITE_DATABASE_ID = "db";
  process.env.APPWRITE_CODES_COLLECTION_ID = "codes";
  process.env.DATA_ENCRYPTION_KEY = "test-key";
  return {
    rows: new Map<string, Record<string, unknown>>(),
    logins: new Map<string, { id: string; created_at: string; app_metadata: Record<string, unknown> }>(),
  };
});

vi.mock("@/lib/server/appwrite", () => ({
  createAdminClient: async () => ({
    database: {
      listDocuments: async (_db: string, _col: string, queries: string[]) => {
        const code = JSON.parse(queries[0]).values[0];
        const docs = [...state.rows.entries()].filter(([, r]) => r.code === code).map(([$id, r]) => ({ $id, ...r }));
        return { documents: docs, total: docs.length };
      },
      createDocument: async (_db: string, _col: string, id: string, data: Record<string, unknown>) => {
        state.rows.set(id, data);
        return { $id: id, ...data };
      },
      updateDocument: async (_db: string, _col: string, id: string, data: Record<string, unknown>) => state.rows.set(id, { ...state.rows.get(id), ...data }),
    },
  }),
}));
vi.mock("@/lib/server/supabase", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: state.logins.get(id) ?? null }, error: null }),
        updateUserById: async (id: string, attrs: { app_metadata: Record<string, unknown> }) => {
          const u = state.logins.get(id)!;
          u.app_metadata = { ...u.app_metadata, ...attrs.app_metadata };
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

const { myReferralCode, redeemCode } = await import("@/lib/server/codes");

const DAY = 86_400_000;
const session = (id: string, joinedDaysAgo = 1) => ({
  id,
  email: `${id}@example.com`,
  provider: "email",
  name: "",
  hasPassword: true,
  lastSignInAt: 0,
  joinedAt: Date.now() - joinedDaysAgo * DAY,
  subscription: null,
  pendingProfile: null,
  offer: null,
});
const login = (id: string, app_metadata: Record<string, unknown> = {}) =>
  state.logins.set(id, { id, created_at: new Date(Date.now() - DAY).toISOString(), app_metadata });
const promo = (code: string, over: Record<string, unknown> = {}) =>
  state.rows.set(`row-${code}`, { code, kind: "promo", ownerId: "", freeDays: 30, maxUses: 0, uses: 0, expiresAt: "", active: true, ...over });

beforeEach(() => {
  state.rows.clear();
  state.logins.clear();
});

describe("promo codes", () => {
  it("gives free days once per login, however the code is typed", async () => {
    login("u1");
    promo("FREE30");
    const result = await redeemCode(session("u1"), " free-30 ");
    expect(result).toMatchObject({ ok: true, freeDays: 30 });
    // Counted from the end of the trial (6 days left), not from today.
    expect((result as { until: number }).until).toBeGreaterThan(Date.now() + 35 * DAY);
    expect(state.logins.get("u1")!.app_metadata).toMatchObject({ redeemed_code: "FREE30", subscription: { status: "cancelled" } });
    expect(state.rows.get("row-FREE30")!.uses).toBe(1);
    expect(await redeemCode(session("u1"), "FREE30")).toEqual({ ok: false, reason: "already" });
  });

  it("refuses unknown, switched-off, expired and used-up codes without counting them", async () => {
    login("u2");
    promo("OFFCODE", { active: false });
    promo("OLDCODE", { expiresAt: new Date(Date.now() - DAY).toISOString() });
    promo("FULL", { maxUses: 2, uses: 2 });
    for (const [code, reason] of [
      ["NOPE", "unknown"],
      ["OFFCODE", "unknown"],
      ["OLDCODE", "expired"],
      ["FULL", "used-up"],
      ["ab", "unknown"],
    ]) {
      expect(await redeemCode(session("u2"), code), code).toEqual({ ok: false, reason });
    }
    expect(state.logins.get("u2")!.app_metadata.redeemed_code).toBeUndefined();
  });

  it("keeps a discount code's offer on the login for checkout, with or without free days", async () => {
    login("u4");
    promo("HALF3", { freeDays: 0, offerId: "offer_abc", discountText: "50% off for the first 3 months" });
    const result = await redeemCode(session("u4"), "half3");
    expect(result).toMatchObject({ ok: true, freeDays: 0, discountText: "50% off for the first 3 months" });
    const meta = state.logins.get("u4")!.app_metadata;
    expect(meta.offer).toEqual({ id: "offer_abc", text: "50% off for the first 3 months", code: "HALF3" });
    expect(meta.subscription).toBeUndefined(); // no free days, so no comp subscription
    expect(state.rows.get("row-HALF3")!.uses).toBe(1);

    login("u5");
    promo("BOTH", { freeDays: 7, offerId: "offer_both", discountText: "20% off for a year" });
    expect(await redeemCode(session("u5"), "BOTH")).toMatchObject({ ok: true, freeDays: 7, discountText: "20% off for a year" });
    expect(state.logins.get("u5")!.app_metadata).toMatchObject({ offer: { id: "offer_both" }, subscription: { status: "cancelled" } });
  });

  it("does nothing for a paying subscriber (Razorpay bills on its own schedule)", async () => {
    login("u3", { subscription: { id: "sub_paid", period: "monthly", status: "active", until: Date.now() + 10 * DAY } });
    promo("FREE30");
    expect(await redeemCode(session("u3"), "FREE30")).toEqual({ ok: false, reason: "subscribed" });
  });
});

describe("referral codes", () => {
  it("is the same code every time for one person, and is remembered so it can be found", async () => {
    const a = await myReferralCode(session("alice"));
    expect(a).toMatch(/^HZ[A-Z0-9]{6}$/);
    expect(await myReferralCode(session("alice"))).toBe(a);
    expect(await myReferralCode(session("bob"))).not.toBe(a);
    expect([...state.rows.values()].filter((r) => r.kind === "referral")).toHaveLength(2);
  });

  it("gives both people the free days, and not to someone using their own code", async () => {
    login("alice");
    login("bob");
    const code = (await myReferralCode(session("alice")))!;
    expect(await redeemCode(session("alice"), code)).toEqual({ ok: false, reason: "own" });
    expect(await redeemCode(session("bob"), code)).toMatchObject({ ok: true, freeDays: 14 });
    const until = (m: Record<string, unknown>) => (m.subscription as { until: number }).until;
    expect(until(state.logins.get("bob")!.app_metadata)).toBeGreaterThan(Date.now() + 19 * DAY); // 6 trial days left + 14
    expect(until(state.logins.get("alice")!.app_metadata)).toBeGreaterThan(Date.now() + 19 * DAY);
  });
});
