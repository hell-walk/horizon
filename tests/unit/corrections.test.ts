import { describe, expect, it } from "vitest";

import { applyCorrections, cleanName, MAX_NAME_LENGTH, MAX_PAYEE_RULES, payeeKey, readCorrections } from "@/lib/corrections";
import { groupByPayee } from "@/lib/payees";
import { groupBySpendType, spendType } from "@/lib/spending";

const tx = (id: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id, name, amount, type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "online", date: "2026-01-01", ...extra }) as Transaction;

describe("cleanName", () => {
  it("trims, squeezes spaces and drops control and invisible characters", () => {
    expect(cleanName("  My \u0000 landlord​  ")).toBe("My landlord");
  });
  it("caps the length", () => {
    expect(cleanName("x".repeat(500))).toHaveLength(MAX_NAME_LENGTH);
  });
  it("refuses empty and non-text values", () => {
    for (const value of ["", "   ", "​", 42, null, { $ne: 1 }]) expect(cleanName(value)).toBeNull();
  });
});

describe("readCorrections", () => {
  it("keeps only well-formed entries", () => {
    const read = readCorrections({
      payees: { zomato: { name: "Food delivery", category: "Food" }, bad: { category: "Not a category" }, odd: "string", empty: {} },
      rows: { r1: { category: "Rent" }, r2: { name: "  " } },
      extra: { anything: true },
    });
    expect(read).toEqual({ payees: { zomato: { name: "Food delivery", category: "Food" } }, rows: { r1: { category: "Rent" } } });
  });
  it("survives junk", () => {
    for (const junk of [undefined, null, "x", 1, [], { payees: "x", rows: 5 }]) expect(readCorrections(junk)).toEqual({ payees: {}, rows: {} });
  });
  it("never holds more than the caps", () => {
    const payees = Object.fromEntries(Array.from({ length: MAX_PAYEE_RULES + 50 }, (_, i) => [`p${i}`, { category: "Food" }]));
    expect(Object.keys(readCorrections({ payees }).payees)).toHaveLength(MAX_PAYEE_RULES);
  });
});

describe("applyCorrections", () => {
  const rows = [tx("a", "UPI/DR/531/RAHUL SHARMA/SBIN/rahul@ybl", -15000), tx("b", "UPI/DR/777/RAHUL SHARMA/SBIN/rahul@ybl", -15000), tx("c", "UPI/DR/1/ZOMATO", -300)];

  it("a payee-wide change reaches every entry from that payee, and keeps the bank's text", () => {
    const out = applyCorrections(rows, { payees: { [payeeKey(rows[0].name)!]: { name: "Rent", category: "Rent" } }, rows: {} });
    expect(out.map((t) => [t.shownName, t.userCategory, t.changedBy])).toEqual([
      ["Rent", "Rent", "payee"],
      ["Rent", "Rent", "payee"],
      [undefined, undefined, undefined],
    ]);
    expect(out[0].name).toBe(rows[0].name);
  });

  it("a change to one entry wins over the payee's", () => {
    const out = applyCorrections(rows, {
      payees: { [payeeKey(rows[0].name)!]: { name: "Rent", category: "Rent" } },
      rows: { b: { category: "Between my accounts" } },
    });
    expect(out[1]).toMatchObject({ shownName: "Rent", userCategory: "Between my accounts", changedBy: "row" });
  });

  it("payees in the same group keep their own key: renaming one SIP does not rename Zerodha", () => {
    expect(payeeKey("Mutual fund SIP")).toBe("mutual fund sip");
    expect(payeeKey("ZERODHA BROKING")).toBe("zerodha broking");
    const list = [tx("s", "Mutual fund SIP", -1000), tx("z", "ZERODHA BROKING", -2000)];
    const out = applyCorrections(list, { payees: { "mutual fund sip": { name: "Monthly SIP" } }, rows: {} });
    expect(out.map((t) => t.shownName)).toEqual(["Monthly SIP", undefined]);
  });

  it("text with no readable payee has no payee key", () => {
    expect(payeeKey("UPI/DR/123456789/0001")).toBeNull();
  });

  it("returns the same list when there is nothing to apply", () => {
    expect(applyCorrections(rows, { payees: {}, rows: {} })).toBe(rows);
  });
});

describe("spending with the user's changes", () => {
  it("the user's category wins over the guess", () => {
    expect(spendType(tx("a", "UPI/DR/1/ZOMATO", -300))).toBe("Food");
    expect(spendType({ ...tx("a", "UPI/DR/1/ZOMATO", -300), userCategory: "Health" })).toBe("Health");
  });

  it("money moved between your own accounts is not spending", () => {
    const list = [tx("a", "Swiggy", -500), { ...tx("b", "NEFT/DR/MY SBI ACCOUNT", -20000), userCategory: "Between my accounts" }];
    expect(groupBySpendType(list).map((b) => [b.name, b.amount])).toEqual([["Food", 500]]);
    expect(groupByPayee(list).map((g) => g.name)).toEqual(["Swiggy"]);
  });

  it("a name the user chose groups payments under it", () => {
    const list = [
      { ...tx("a", "UPI/DR/1/RAHUL SHARMA", -15000), shownName: "Landlord" },
      { ...tx("b", "UPI/DR/2/RAHUL SHARMA", -15000), shownName: "Landlord" },
    ];
    expect(groupByPayee(list).map((g) => [g.name, g.count])).toEqual([["Landlord", 2]]);
  });
});
