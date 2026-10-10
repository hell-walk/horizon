import { describe, expect, it } from "vitest";

import { bankDesignFor, cardBackground, CLASSIC, designChoices, isKnownDesign, resolveCardDesign } from "@/lib/cardDesigns";
import { resolveAccountId } from "@/lib/selectedAccount";
import { extractCustomerIdFromUrl, formatAmount, maskLabel } from "@/lib/utils";

const account = (id: string) => ({ appwriteItemId: id }) as Account;

describe("resolveAccountId: the account the whole app is looking at", () => {
  const accounts = [account("a1"), account("a2")];

  it("prefers an explicit ?id that is one of the user's accounts", () => {
    expect(resolveAccountId(accounts, "a2", "a1")).toBe("a2");
  });
  it("ignores an id that is not the user's (someone else's account)", () => {
    expect(resolveAccountId(accounts, "someone-elses", undefined)).toBe("a1");
    expect(resolveAccountId(accounts, undefined, "someone-elses")).toBe("a1");
  });
  it("falls back to the remembered account, then the first", () => {
    expect(resolveAccountId(accounts, undefined, "a2")).toBe("a2");
    expect(resolveAccountId(accounts)).toBe("a1");
  });
  it("ignores repeated ?id parameters", () => {
    expect(resolveAccountId(accounts, ["a2", "a1"])).toBe("a1");
  });
  it("returns nothing when there are no accounts", () => {
    expect(resolveAccountId([], "a1")).toBeUndefined();
  });
});

describe("card designs", () => {
  it("matches a bank skin by name", () => {
    expect(bankDesignFor({ name: "HDFC Bank Savings", officialName: "" })).toBeDefined();
  });
  it("falls back to Classic for unknown banks", () => {
    expect(resolveCardDesign({ name: "Mystery Bank", officialName: "", cardDesign: undefined }).id).toBe(CLASSIC.id);
  });
  it("uses a chosen theme over the automatic skin", () => {
    const theme = designChoices({ name: "HDFC Bank", officialName: "" }).find((d) => d.id !== "auto" && d.id !== CLASSIC.id);
    expect(theme).toBeDefined();
    expect(resolveCardDesign({ name: "HDFC Bank", officialName: "", cardDesign: theme!.id }).id).toBe(theme!.id);
  });
  it("only accepts known design ids (the server action relies on this)", () => {
    expect(isKnownDesign("auto")).toBe(true);
    expect(isKnownDesign(CLASSIC.id)).toBe(true);
    expect(isKnownDesign("<script>")).toBe(false);
    expect(isKnownDesign("")).toBe(false);
  });
  it("builds a CSS background from the design colours", () => {
    expect(cardBackground(CLASSIC)).toContain(CLASSIC.from);
  });
});

describe("formatting helpers", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatAmount(124560.5, "INR")).toMatch(/1,24,560\.50/);
  });
  it("formats dollars", () => {
    expect(formatAmount(2450.4, "USD")).toMatch(/2,450\.40/);
  });
  it("masks account numbers", () => {
    expect(maskLabel("4821")).toBe("••4821");
    expect(maskLabel()).toBe("••0000");
  });
  it("pulls the customer id out of a Dwolla URL", () => {
    expect(extractCustomerIdFromUrl("https://api-sandbox.dwolla.com/customers/abc-123")).toBe("abc-123");
  });
});
