import { describe, expect, it } from "vitest";

import { findSalary, incomingPayers, salaryCandidates } from "@/lib/income";

import { PROFILES } from "./salary-profiles";

// The permanent check on "is this person salaried?": each realistic person in
// salary-profiles.ts, and what Horizon should conclude. A rule change that
// gets any of them wrong fails here.
const decide = (p: (typeof PROFILES)[number]) => {
  const best = salaryCandidates(p.rows, { ownNames: p.ownNames }).find((c) => c.confidence !== "low");
  return { best, said: !best ? "no" : best.confidence === "high" ? "yes" : "ask" };
};

describe("is this person salaried? (realistic profiles)", () => {
  for (const p of PROFILES) {
    it(`${p.id} ${p.who}: ${p.expect}`, () => {
      const { best, said } = decide(p);
      expect(said).toBe(p.expect);
      if (p.expect !== "no" && best) {
        if (p.payee) expect(best.payee).toMatch(p.payee);
        if (p.monthly) expect(Math.abs(best.monthly - p.monthly)).toBeLessThanOrEqual(p.monthly * 0.05);
      }
    });
  }

  it("never names a branch code or a reference number as the employer", () => {
    for (const p of PROFILES) {
      const { best } = decide(p);
      if (best) expect(best.payee).not.toMatch(/\b[A-Z]{4}0[A-Z0-9]{6}\b|\b[A-Z]{1,4}\d{5,}\b/i);
    }
  });
});

describe("the person's word", () => {
  const steadyCompany = PROFILES.find((p) => p.id === "A2")!;
  const uneven = PROFILES.find((p) => p.id === "N3")!;

  it("a payer the person confirmed is their salary, however Horizon scored it", () => {
    expect(findSalary(uneven.rows, { prefer: "Bright Designs" })).toMatchObject({ payee: "Bright Designs", confidence: "high" });
  });

  it("a payer the person said is not their salary is never offered again", () => {
    expect(findSalary(steadyCompany.rows)).toMatchObject({ payee: expect.stringMatching(/globex/i), confidence: "medium" });
    expect(findSalary(steadyCompany.rows, { exclude: ["Globex Solutions"] })).toBeUndefined();
  });

  it("lists who sent money in, biggest first, to pick the salary from", () => {
    const payers = incomingPayers(steadyCompany.rows);
    expect(payers[0]).toMatchObject({ payee: expect.stringMatching(/globex/i), months: 5 });
    expect(payers.every((p) => p.total > 0)).toBe(true);
  });
});
