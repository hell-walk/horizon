import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// The real plan rules (server/plan.ts), the real goal action on top of them,
// the real plan actions and webhook, with Supabase, Appwrite and Razorpay faked.
const state = vi.hoisted(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
  process.env.RAZORPAY_KEY_SECRET = "unit-secret";
  process.env.RAZORPAY_PLAN_MONTHLY = "plan_monthly";
  process.env.RAZORPAY_PLAN_YEARLY = "plan_yearly";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_unit";
  return {
    session: null as null | Record<string, unknown>,
    prefs: {} as Record<string, unknown>,
    saved: [] as { id: string; subscription: Record<string, unknown> }[],
    users: new Map<string, Record<string, unknown>>(),
    razorpay: [] as { method: string; path: string; body?: Record<string, unknown> }[],
    remote: new Map<string, Record<string, unknown>>(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => ({ get: () => null }) }));
vi.mock("@/lib/server/auth", () => ({
  loadSession: async () => state.session,
  getLoggedInUser: async () => (state.session ? { $id: `profile-${state.session.id}`, userId: state.session.id } : null),
  ownerIdOf: (u: { $id: string }) => u.$id,
}));
vi.mock("@/lib/server/prefs", () => ({
  readPrefs: async () => JSON.parse(JSON.stringify(state.prefs)),
  updatePrefs: async (_id: string, change: Record<string, unknown>) => (state.prefs = { ...state.prefs, ...JSON.parse(JSON.stringify(change)) }),
}));
vi.mock("@/lib/server/supabase", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        updateUserById: async (id: string, attrs: { app_metadata: { subscription: Record<string, unknown> } }) => {
          state.saved.push({ id, subscription: attrs.app_metadata.subscription });
          return { data: {}, error: null };
        },
        getUserById: async (id: string) => ({ data: { user: state.users.get(id) ?? null }, error: null }),
      },
    },
  }),
}));

// Razorpay's API, in memory.
vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
  const path = url.replace("https://api.razorpay.com/v1", "");
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  state.razorpay.push({ method: init.method ?? "GET", path, body });
  if (path === "/subscriptions" && init.method === "POST") {
    const created = { id: `sub_${state.remote.size + 1}`, plan_id: body.plan_id, status: "created", current_end: null, short_url: "https://rzp.io/i/pay", notes: body.notes };
    state.remote.set(created.id, created);
    return new Response(JSON.stringify(created));
  }
  const id = path.split("/")[2];
  const sub = state.remote.get(id);
  if (!sub) return new Response(JSON.stringify({ error: { description: "not found" } }), { status: 400 });
  if (path.endsWith("/cancel")) return new Response(JSON.stringify(sub)); // stays "active" until the period ends
  return new Response(JSON.stringify(sub));
});

const { saveGoal, deleteGoal } = await import("@/lib/actions/goal.action");
const { startSubscription, checkSubscription, cancelMySubscription } = await import("@/lib/actions/plan.action");
const { POST: webhook } = await import("@/app/api/razorpay/webhook/route");

const DAY = 86_400_000;
let n = 0;
const login = (over: Record<string, unknown> = {}) => {
  state.session = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, email: "p@example.com", joinedAt: Date.now() - DAY, subscription: null, ...over };
  return state.session.id as string;
};

beforeEach(() => {
  state.session = null;
  state.prefs = {};
  state.saved = [];
  state.users.clear();
  state.razorpay = [];
  state.remote.clear();
});

describe("the free trial", () => {
  it("allows 3 changes a day, then says so; refused or invalid attempts cost nothing", async () => {
    login();
    expect(await saveGoal({ name: "", target: 0 })).toMatchObject({ ok: false }); // invalid: not counted
    for (let i = 0; i < 3; i++) expect(await saveGoal({ name: `Goal ${i}`, target: 1000 })).toEqual({ ok: true });
    expect(await saveGoal({ name: "Fourth", target: 1000 })).toEqual({ ok: false, error: expect.stringMatching(/today's 3 free changes/) });
    expect((state.prefs.goals as unknown[]).length).toBe(3);
  });

  it("each person has their own count", async () => {
    login();
    for (let i = 0; i < 3; i++) await saveGoal({ name: `Goal ${i}`, target: 1000 });
    login();
    expect(await saveGoal({ name: "Mine", target: 1000 })).toEqual({ ok: true });
  });

  it("after the trial, Horizon is view-only, but deleting your own things still works", async () => {
    login({ joinedAt: Date.now() - 8 * DAY });
    state.prefs = { goals: [{ id: "g-aaaaaaaaaaaa", name: "Old", target: 1, saved: 0, currency: "INR" }] };
    expect(await saveGoal({ name: "New", target: 1000 })).toEqual({ ok: false, error: expect.stringMatching(/free week has ended/) });
    expect(await deleteGoal({ id: "g-aaaaaaaaaaaa" })).toEqual({ ok: true });
  });

  it("subscribers have no daily limit", async () => {
    login({ joinedAt: Date.now() - 30 * DAY, subscription: { id: "sub_x", period: "monthly", status: "active", until: Date.now() + DAY } });
    for (let i = 0; i < 5; i++) expect(await saveGoal({ name: `Goal ${i}`, target: 1000 })).toEqual({ ok: true });
  });
});

describe("startSubscription", () => {
  it("needs a session and a real plan", async () => {
    expect(await startSubscription({ period: "monthly" })).toMatchObject({ ok: false });
    login();
    // @ts-expect-error: wrong value on purpose
    expect(await startSubscription({ period: "lifetime" })).toMatchObject({ ok: false });
    expect(state.razorpay).toEqual([]);
  });

  it("opens Razorpay's page for the signed-in login only, and remembers it as not paid yet", async () => {
    const me = login();
    expect(await startSubscription({ period: "yearly" })).toEqual({ ok: true, url: "https://rzp.io/i/pay" });
    expect(state.razorpay[0].body).toMatchObject({ plan_id: "plan_yearly", notes: { login: me } });
    expect(state.saved).toEqual([{ id: me, subscription: { id: "sub_1", period: "yearly", status: "created", until: 0 } }]);
  });

  it("two clicks at once open one subscription, not two", async () => {
    login();
    const [a, b] = await Promise.all([startSubscription({ period: "monthly" }), startSubscription({ period: "monthly" })]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ error: expect.stringMatching(/already opening/) });
    expect(state.razorpay.filter((c) => c.method === "POST" && c.path === "/subscriptions")).toHaveLength(1);
    // Once the first is done, the lock is gone (a later click is not stuck).
    expect(await startSubscription({ period: "yearly" })).toMatchObject({ ok: true });
  });

  it("refuses when already subscribed", async () => {
    login({ subscription: { id: "sub_x", period: "monthly", status: "active", until: Date.now() + DAY } });
    expect(await startSubscription({ period: "monthly" })).toEqual({ ok: false, error: "You are already subscribed." });
  });
});

describe("checking and cancelling", () => {
  it("check asks Razorpay and stores what it says", async () => {
    const me = login();
    const end = Math.floor(Date.now() / 1000) + 30 * 86400;
    state.remote.set("sub_9", { id: "sub_9", plan_id: "plan_monthly", status: "active", current_end: end, notes: { login: me } });
    state.session!.subscription = { id: "sub_9", period: "monthly", status: "created", until: 0 };
    expect(await checkSubscription()).toEqual({ ok: true, subscribed: true });
    expect(state.saved.at(-1)).toEqual({ id: me, subscription: { id: "sub_9", period: "monthly", status: "active", until: end * 1000 } });
  });

  it("cancel stops renewing and keeps the paid period", async () => {
    const me = login();
    const end = Math.floor(Date.now() / 1000) + 20 * 86400;
    state.remote.set("sub_9", { id: "sub_9", plan_id: "plan_monthly", status: "active", current_end: end, notes: { login: me } });
    state.session!.subscription = { id: "sub_9", period: "monthly", status: "active", until: end * 1000 };
    expect(await cancelMySubscription()).toEqual({ ok: true, until: end * 1000 });
    expect(state.razorpay.at(-1)).toMatchObject({ method: "POST", path: "/subscriptions/sub_9/cancel", body: { cancel_at_cycle_end: 1 } });
    expect(state.saved.at(-1)?.subscription).toMatchObject({ status: "cancelled", until: end * 1000 });
  });
});

describe("the Razorpay webhook", () => {
  const send = (body: string, signature?: string) =>
    webhook(new Request("http://localhost/api/razorpay/webhook", { method: "POST", body, headers: signature ? { "x-razorpay-signature": signature } : {} }) as never);
  const sign = (body: string, secret = "whsec_unit") => createHmac("sha256", secret).update(body).digest("hex");
  const event = (id: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id, status: "active", current_end: 4102444800, notes: { login: "attacker" }, ...extra } } } });

  it("refuses unsigned and wrongly signed messages, and changes nothing", async () => {
    const body = event("sub_1");
    expect((await send(body)).status).toBe(401);
    expect((await send(body, sign(body, "guessed-secret"))).status).toBe(401);
    expect((await send(body, "0".repeat(64))).status).toBe(401);
    expect(state.saved).toEqual([]);
  });

  it("trusts Razorpay's own record, not the message: the login comes from the subscription Horizon created", async () => {
    const me = login();
    state.users.set(me, { id: me, app_metadata: {} });
    const end = Math.floor(Date.now() / 1000) + 30 * 86400;
    state.remote.set("sub_7", { id: "sub_7", plan_id: "plan_monthly", status: "active", current_end: end, notes: { login: me } });
    const body = event("sub_7"); // the message claims another login and a far-off date
    expect((await send(body, sign(body))).status).toBe(200);
    expect(state.saved).toEqual([{ id: me, subscription: { id: "sub_7", period: "monthly", status: "active", until: end * 1000 } }]);
  });

  it("ignores subscriptions Horizon did not start", async () => {
    state.remote.set("sub_8", { id: "sub_8", plan_id: "plan_someone_elses", status: "active", current_end: 4102444800, notes: {} });
    const body = event("sub_8");
    expect((await send(body, sign(body))).status).toBe(200);
    expect(state.saved).toEqual([]);
  });
});
