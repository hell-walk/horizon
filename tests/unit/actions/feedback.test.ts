import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { $id: string; userId: string; email: string },
  saved: [] as Record<string, unknown>[],
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => ({ get: () => null }) }));
vi.mock("@/lib/server/auth", () => ({ getLoggedInUser: async () => state.user, ownerIdOf: (u: { $id: string }) => u.$id }));
vi.mock("@/lib/server/appwrite", () => ({
  createAdminClient: async () => ({ database: { createDocument: async (_db: string, _col: string, _id: string, data: Record<string, unknown>) => state.saved.push(data) } }),
}));

const { sendFeedback } = await import("@/lib/actions/feedback.action");

let n = 0;
beforeEach(() => {
  state.user = { $id: `profile-${++n}`, userId: `auth-${n}`, email: "me@example.com" };
  state.saved = [];
});

describe("sendFeedback", () => {
  it("needs a session", async () => {
    state.user = null;
    expect(await sendFeedback({ kind: "idea", message: "Please add credit cards." })).toMatchObject({ ok: false });
    expect(state.saved).toEqual([]);
  });

  it("keeps it under the signed-in profile, with the email only when they allow a reply", async () => {
    expect(await sendFeedback({ kind: "missing", message: "  Credit card bills, please.  ", page: "/bills" })).toEqual({ ok: true });
    expect(state.saved[0]).toMatchObject({ ownerId: `profile-${n}`, kind: "missing", message: "Credit card bills, please.", page: "/bills", replyTo: null });
    expect(await sendFeedback({ kind: "idea", message: "A dark mode toggle.", mayReply: true })).toEqual({ ok: true });
    expect(state.saved[1]).toMatchObject({ replyTo: "me@example.com" });
  });

  it("ignores who the form says it is from", async () => {
    // @ts-expect-error: extra fields on purpose
    await sendFeedback({ kind: "other", message: "Hello from someone else", ownerId: "profile-victim", replyTo: "victim@example.com" });
    expect(state.saved[0]).toMatchObject({ ownerId: `profile-${n}`, replyTo: null });
  });

  it("refuses unknown kinds, too short or too long messages, and pages that are not this site's", async () => {
    expect(await sendFeedback({ kind: "<script>", message: "A long enough message" })).toMatchObject({ ok: false });
    expect(await sendFeedback({ kind: "idea", message: "short" })).toMatchObject({ ok: false });
    expect(await sendFeedback({ kind: "idea", message: "x".repeat(2001) })).toMatchObject({ ok: false });
    // @ts-expect-error: wrong shape on purpose
    expect(await sendFeedback({ kind: "idea", message: { $ne: "" } })).toMatchObject({ ok: false });
    await sendFeedback({ kind: "idea", message: "A long enough message", page: "https://evil.example/x" });
    expect(state.saved).toEqual([expect.objectContaining({ page: "" })]);
  });

  it("allows 5 messages an hour per person", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await sendFeedback({ kind: "idea", message: `Idea number ${i}` }));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toMatchObject({ ok: false });
  });
});
