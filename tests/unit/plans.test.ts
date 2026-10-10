import { describe, expect, it } from "vitest";

import { daysLeft, istDay, mergeSubscription, planFrom, readSubscription, TRIAL_CHANGES_PER_DAY, TRIAL_DAYS, type Subscription } from "@/lib/plans";

const DAY = 86_400_000;
const now = Date.parse("2026-10-11T12:00:00Z");
const sub = (over: Partial<Subscription> = {}): Subscription => ({ id: "sub_1", period: "monthly", status: "active", until: now + 10 * DAY, ...over });

describe("planFrom", () => {
  it("a new account is on the trial, with today's changes counted", () => {
    expect(planFrom({ joinedAt: now - DAY, subscription: null, usedToday: 2, now })).toEqual({ kind: "trial", endsAt: now - DAY + TRIAL_DAYS * DAY, usedToday: 2, limit: TRIAL_CHANGES_PER_DAY });
  });

  it("after the trial, without paying, it has ended", () => {
    expect(planFrom({ joinedAt: now - (TRIAL_DAYS + 1) * DAY, subscription: null, usedToday: 0, now })).toMatchObject({ kind: "ended", pending: false });
  });

  it("a paid-up subscription wins, during the trial or after", () => {
    expect(planFrom({ joinedAt: now - DAY, subscription: sub(), usedToday: 3, now })).toMatchObject({ kind: "subscribed", renews: true });
    expect(planFrom({ joinedAt: now - 99 * DAY, subscription: sub({ status: "cancelled" }), usedToday: 0, now })).toMatchObject({ kind: "subscribed", renews: false });
  });

  it("an unpaid or lapsed subscription gives nothing", () => {
    const old = now - 99 * DAY;
    expect(planFrom({ joinedAt: old, subscription: sub({ status: "created", until: 0 }), usedToday: 0, now })).toMatchObject({ kind: "ended", pending: true });
    expect(planFrom({ joinedAt: old, subscription: sub({ status: "halted", until: now - 1 }), usedToday: 0, now })).toMatchObject({ kind: "ended", pending: false });
  });
});

describe("mergeSubscription", () => {
  it("keeps a cancellation Razorpay still calls active, and never moves the paid-up date back", () => {
    expect(mergeSubscription(sub({ status: "cancelled" }), sub({ status: "active", until: now }))).toMatchObject({ status: "cancelled", until: now + 10 * DAY });
    expect(mergeSubscription(sub({ status: "cancelled" }), sub({ status: "completed" }))).toMatchObject({ status: "completed" });
  });

  it("a late message about an older subscription never replaces a newer one", () => {
    const current = sub({ id: "sub_new", until: now + 30 * DAY });
    expect(mergeSubscription(current, sub({ id: "sub_old", status: "cancelled", until: now - DAY }))).toBe(current);
    expect(mergeSubscription(sub({ id: "sub_old", until: now - DAY }), current)).toBe(current);
  });
});

describe("helpers", () => {
  it("readSubscription ignores anything malformed", () => {
    for (const bad of [null, "x", 1, {}, { id: 1, period: "monthly", status: "active" }, { id: "s", period: "weekly", status: "active" }]) expect(readSubscription(bad)).toBeNull();
    expect(readSubscription({ id: "s", period: "yearly", status: "active", until: "soon" })).toEqual({ id: "s", period: "yearly", status: "active", until: 0 });
  });

  it("the day turns over at midnight in India", () => {
    expect(istDay(Date.parse("2026-10-11T18:29:00Z"))).toBe("2026-10-11");
    expect(istDay(Date.parse("2026-10-11T18:31:00Z"))).toBe("2026-10-12");
  });

  it("counts a part day as a day left", () => {
    expect(daysLeft(now + 6.2 * DAY, now)).toBe(7);
    expect(daysLeft(now - DAY, now)).toBe(0);
  });
});
