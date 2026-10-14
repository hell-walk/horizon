import { afterEach, describe, expect, it } from "vitest";

import { categorize, isPayLater } from "@/lib/categories";
import { setExtraTerms } from "@/lib/extraTerms";
import { findRegular } from "@/lib/recurring";
import { spendType } from "@/lib/spending";
import { matchingTerms, normalizeTerm, termsPattern } from "@/lib/terms";

// The names the team adds from the admin portal, matched on top of the built-in lists.

const none = { paylater: [], subscription: [] };
afterEach(() => setExtraTerms(none));

describe("termsPattern", () => {
  it("matches as a whole word, any case, spaces optional", () => {
    const p = termsPattern(["lazy pay", "navi"])!;
    expect(p.test("UPI/412/LAZYPAY@AXIS")).toBe(true);
    expect(p.test("Lazy Pay EMI")).toBe(true);
    expect(p.test("navigate services")).toBe(false);
    expect(p.test("lazypayment")).toBe(false);
  });

  it("keeps & and drops other punctuation", () => {
    expect(normalizeTerm(" Bajaj-Finserv ")).toBe("bajaj finserv");
    expect(termsPattern(["L&T Fin"])!.test("NACH L&T FIN LTD")).toBe(true);
    expect(termsPattern([])).toBeNull();
    expect(matchingTerms("UPI/LAZYPAY@AXIS", ["lazy pay", "hotstar"])).toEqual(["lazy pay"]);
  });
});

describe("added names in the sorting rules", () => {
  it("a lender added from the portal sorts as EMI & pay later everywhere", () => {
    const name = "NACH/ACME MICROLEND/INST 7";
    expect(isPayLater(name)).toBe(false);
    expect(categorize(name)).not.toBe("EMI & pay later");
    expect(spendType({ name, category: "Transfer", paymentChannel: "other" })).toBe("Bank transfer");

    setExtraTerms({ paylater: ["acme microlend"], subscription: [] });
    expect(isPayLater(name)).toBe(true);
    expect(categorize(name)).toBe("EMI & pay later");
    expect(spendType({ name, category: "Transfer", paymentChannel: "other" })).toBe("EMI & pay later");
  });

  it("a subscription service added from the portal sorts as Subscriptions", () => {
    const name = "POS 1234 FOOCINEMA PLUS";
    expect(spendType({ name, category: "Shopping", paymentChannel: "other" })).toBe("Card");
    setExtraTerms({ paylater: [], subscription: ["foocinema"] });
    expect(spendType({ name, category: "Shopping", paymentChannel: "other" })).toBe("Subscriptions");
  });

  it("a person's own correction still wins", () => {
    setExtraTerms({ paylater: ["acme microlend"], subscription: [] });
    expect(spendType({ name: "ACME MICROLEND", category: "", paymentChannel: "other", userCategory: "Rent" })).toBe("Rent");
  });

  it("the regular-payments finder calls an added lender an EMI", () => {
    setExtraTerms({ paylater: ["acme microlend"], subscription: [] });
    const rows = [1, 2, 3].map((m) => ({ id: `t${m}`, name: "NACH ACME MICROLEND", amount: 2500, type: "debit", date: `2026-0${m}-05`, category: "Transfer", paymentChannel: "other", pending: false, accountId: "a", image: "", currency: "INR" })) as unknown as Transaction[];
    const emi = findRegular(rows, new Date("2026-03-20")).find((r) => r.kind === "emi");
    expect(emi).toBeTruthy();
  });
});
