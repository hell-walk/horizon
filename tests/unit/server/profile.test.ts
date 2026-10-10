import { describe, expect, it } from "vitest";

import { pendingFrom, profileIsValid, readPending } from "@/lib/server/profile";

const india = { country: "IN", firstName: "Ada", lastName: "Lovelace", address1: "1 Main St", city: "Pune", state: "MH", postalCode: "411001", dateOfBirth: "", ssn: "" };

describe("sign-up details waiting on the login", () => {
  it("never carry the date of birth or SSN", () => {
    expect(pendingFrom({ ...india, dateOfBirth: "1990-01-01", ssn: "123456789" })).not.toHaveProperty("ssn");
    expect(JSON.stringify(pendingFrom({ ...india, dateOfBirth: "1990-01-01", ssn: "123456789" }))).not.toMatch(/1990|123456789/);
  });

  it("are read back only when every field is a sane string (the person can edit their own metadata)", () => {
    expect(readPending(pendingFrom(india))).toMatchObject({ country: "IN", city: "Pune", dateOfBirth: "", ssn: "" });
    for (const bad of [null, "x", {}, { ...pendingFrom(india), country: "XX" }, { ...pendingFrom(india), city: { $ne: 1 } }, { ...pendingFrom(india), address1: "a".repeat(500) }]) {
      expect(readPending(bad)).toBeNull();
    }
  });
});

describe("profileIsValid", () => {
  it("asks the US date of birth and SSN only when the profile is made", () => {
    const us = { ...india, country: "US", state: "NY", postalCode: "10001" };
    expect(profileIsValid(us, { identity: false })).toBe(true);
    expect(profileIsValid(us, { identity: true })).toBe(false);
    expect(profileIsValid({ ...us, dateOfBirth: "1990-01-01", ssn: "1234" }, { identity: true })).toBe(true);
    expect(profileIsValid({ ...us, state: "MH" }, { identity: false })).toBe(false);
  });
});
