import { describe, expect, it } from "vitest";

import { addMonth, monthsBetween, planGoal, readGoal, readGoals } from "@/lib/goals";

describe("month arithmetic", () => {
  it("adds months across years and counts them", () => {
    expect(addMonth("2026-10", 3)).toBe("2027-01");
    expect(addMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonth("2026-01", 0)).toBe("2026-01");
    expect(monthsBetween("2026-10", "2027-03")).toBe(5);
  });
});

describe("planGoal", () => {
  it("works out when a goal is reached from the monthly saving", () => {
    // ₹60,000 emergency fund, ₹10,000 saved, ₹5,000 a month: 10 months, so August 2027.
    expect(planGoal({ target: 60000, saved: 10000, monthly: 5000 }, "2026-10")).toEqual({ remaining: 50000, done: false, monthsNeeded: 10, reachedIn: "2027-08" });
  });

  it("rounds a part month up", () => {
    expect(planGoal({ target: 10000, saved: 0, monthly: 3000 }, "2026-10")).toMatchObject({ monthsNeeded: 4 });
  });

  it("works out what each month must hold for a target month, and whether the saving is enough", () => {
    // ₹30,000 for a trip by March 2027: Oct, Nov, Dec, Jan, Feb, Mar = 6 months, ₹5,000 each.
    expect(planGoal({ target: 30000, saved: 0, by: "2027-03" }, "2026-10")).toMatchObject({ monthsLeft: 6, neededMonthly: 5000 });
    expect(planGoal({ target: 30000, saved: 0, by: "2027-03", monthly: 4000 }, "2026-10")).toMatchObject({ onTrack: false });
    expect(planGoal({ target: 30000, saved: 0, by: "2027-03", monthly: 5000 }, "2026-10")).toMatchObject({ onTrack: true });
  });

  it("answers 'what if I save more each month'", () => {
    const base = planGoal({ target: 60000, saved: 10000, monthly: 5000 }, "2026-10");
    const more = planGoal({ target: 60000, saved: 10000, monthly: 5000 }, "2026-10", 5000);
    expect([base.monthsNeeded, more.monthsNeeded, more.reachedIn]).toEqual([10, 5, "2027-03"]);
  });

  it("says when a goal is already reached", () => {
    expect(planGoal({ target: 5000, saved: 6000 }, "2026-10")).toEqual({ remaining: 0, done: true });
  });
});

describe("readGoal", () => {
  it("accepts a sensible goal and cleans its name", () => {
    expect(readGoal({ name: "  Emergency​ fund ", target: 60000, saved: "", monthly: 5000, by: "2027-08" }, "2026-10")).toEqual({
      name: "Emergency fund",
      target: 60000,
      saved: 0,
      monthly: 5000,
      by: "2027-08",
    });
  });

  it("refuses anything wrong", () => {
    for (const bad of [
      { name: "", target: 100 },
      { name: "x", target: 0 },
      { name: "x", target: -5 },
      { name: "x", target: "100" },
      { name: "x", target: 1e13 },
      { name: "x", target: 100, saved: -1 },
      { name: "x", target: 100, monthly: Number.NaN },
      { name: "x", target: 100, by: "2027-13" },
      { name: "x", target: 100, by: "next year" },
      { name: { $ne: 1 }, target: 100 },
      null,
    ]) {
      expect(readGoal(bad, "2026-10"), JSON.stringify(bad)).toBeNull();
    }
    expect(readGoal({ name: "Old", target: 100, by: "2026-01" }, "2026-10")).toBeNull(); // in the past
  });

  it("reads stored goals defensively", () => {
    const stored = [
      { id: "g1", currency: "INR", name: "Trip", target: 30000, saved: 0 },
      { id: "bad id!", currency: "INR", name: "x", target: 1 },
      { id: "g2", currency: "rupees", name: "x", target: 1 },
      "junk",
    ];
    expect(readGoals(stored).map((g) => g.id)).toEqual(["g1"]);
    expect(readGoals("nope")).toEqual([]);
  });
});
