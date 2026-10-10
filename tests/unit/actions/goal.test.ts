import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { $id: string; userId: string },
  prefs: {} as Record<string, unknown>,
  writes: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => ({ get: () => null }) }));
vi.mock("@/lib/server/auth", () => ({
  getLoggedInUser: async () => state.user,
  ownerIdOf: (u: { $id: string }) => u.$id,
  authIdOf: (u: { userId: string }) => u.userId,
}));
vi.mock("@/lib/server/appwrite", () => ({
  createAdminClient: async () => ({
    user: {
      getPrefs: async () => JSON.parse(JSON.stringify(state.prefs)),
      updatePrefs: async (_id: string, prefs: Record<string, unknown>) => {
        state.writes++;
        state.prefs = prefs;
      },
    },
  }),
}));

const { saveGoal, deleteGoal } = await import("@/lib/actions/goal.action");

let n = 0;
beforeEach(() => {
  // Fresh ids per test, so the rate limit and the goals cache never carry over.
  state.user = { $id: `profile-${++n}`, userId: `auth-${n}` };
  state.prefs = { statementLayouts: { sig: { date: 0 } } };
  state.writes = 0;
});

const goals = () => state.prefs.goals as { id: string; name: string; target: number; currency: string }[];

describe("saveGoal", () => {
  it("needs a session", async () => {
    state.user = null;
    expect(await saveGoal({ name: "Trip", target: 30000 })).toMatchObject({ ok: false });
    expect(state.writes).toBe(0);
  });

  it("adds a goal and keeps the other preferences", async () => {
    expect(await saveGoal({ name: " Goa trip ", target: 30000, monthly: 5000, currency: "INR" })).toEqual({ ok: true });
    expect(goals()).toEqual([{ id: expect.stringMatching(/^g-[\w-]{12}$/), currency: "INR", name: "Goa trip", target: 30000, saved: 0, monthly: 5000 }]);
    expect(state.prefs.statementLayouts).toEqual({ sig: { date: 0 } });
  });

  it("changes only the user's own goal, by id", async () => {
    await saveGoal({ name: "Trip", target: 30000 });
    const id = goals()[0].id;
    expect(await saveGoal({ id, name: "Trip", target: 40000 })).toEqual({ ok: true });
    expect(goals()[0]).toMatchObject({ id, target: 40000 });
    // An id that is not one of theirs (someone else's, or made up) changes nothing.
    const before = state.writes;
    expect(await saveGoal({ id: "g-someone-else", name: "Hijack", target: 1 })).toMatchObject({ ok: false });
    expect(state.writes).toBe(before);
  });

  it("refuses bad input", async () => {
    for (const bad of [
      { name: "", target: 100 },
      { name: "x", target: -1 },
      { name: "x", target: 100, by: "2020-01" },
      { name: "x", target: 100, id: "../../etc" },
      { name: { $ne: 1 }, target: 100 },
    ]) {
      // @ts-expect-error: wrong shapes on purpose
      expect(await saveGoal(bad), JSON.stringify(bad)).toMatchObject({ ok: false });
    }
    expect(state.writes).toBe(0);
  });

  it("stops at 20 goals", async () => {
    state.prefs = { goals: Array.from({ length: 20 }, (_, i) => ({ id: `g-${i}`, currency: "INR", name: `G${i}`, target: 100, saved: 0 })) };
    expect(await saveGoal({ name: "One more", target: 100 })).toMatchObject({ ok: false });
  });
});

describe("deleteGoal", () => {
  it("removes the user's own goal and nothing else", async () => {
    await saveGoal({ name: "A", target: 100 });
    await saveGoal({ name: "B", target: 200 });
    const [a, b] = goals();
    expect(await deleteGoal({ id: a.id })).toEqual({ ok: true });
    expect(goals().map((g) => g.id)).toEqual([b.id]);
    expect(await deleteGoal({ id: "g-not-mine" })).toMatchObject({ ok: false });
    expect(goals()).toHaveLength(1);
  });

  it("needs a session", async () => {
    state.user = null;
    expect(await deleteGoal({ id: "g-1" })).toMatchObject({ ok: false });
  });
});
