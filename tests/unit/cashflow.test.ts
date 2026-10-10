import { describe, expect, it, vi } from "vitest";

import { monthlyFlow } from "@/lib/cashflow";

const tx = (date: string, name: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({ id: `${date}-${name}`, date, name, amount: Math.abs(amount), type: amount < 0 ? "debit" : "credit", category: "Transfer", paymentChannel: "other", ...extra }) as Transaction;

describe("monthlyFlow", () => {
  it("adds up money in, money out and what was left, newest month first", () => {
    const months = monthlyFlow([
      tx("2026-08-01", "SALARY", 50000),
      tx("2026-08-05", "Swiggy", -400),
      tx("2026-08-20", "RENT PAID", -15000),
      tx("2026-09-01", "SALARY", 50000),
      tx("2026-09-03", "Zomato", -600.5),
    ]);
    expect(months.map((m) => [m.month, m.moneyIn, m.moneyOut, m.left, m.entries])).toEqual([
      ["2026-09", 50000, 600.5, 49399.5, 2],
      ["2026-08", 50000, 15400, 34600, 3],
    ]);
    expect(months[1].topSpending).toEqual([
      { name: "Rent", amount: 15000 },
      { name: "Food", amount: 400 },
    ]);
    expect(months[1]).toMatchObject({ from: "2026-08-01", to: "2026-08-20" });
  });

  it("goes below zero when more went out than came in", () => {
    expect(monthlyFlow([tx("2026-08-01", "SALARY", 1000), tx("2026-08-02", "Flipkart", -1500)])[0].left).toBe(-500);
  });

  it("leaves out money moved between your own accounts", () => {
    const months = monthlyFlow([
      tx("2026-08-01", "SALARY", 50000),
      tx("2026-08-02", "NEFT TO MY SBI", -20000, { userCategory: "Between my accounts" }),
      tx("2026-08-03", "NEFT FROM MY SBI", 5000, { userCategory: "Between my accounts" }),
    ]);
    expect(months[0]).toMatchObject({ moneyIn: 50000, moneyOut: 0, entries: 1 });
  });

  it("uses the user's own categories for where the money went", () => {
    const months = monthlyFlow([tx("2026-08-02", "UPI/RAHUL SHARMA", -15000, { userCategory: "Rent" })]);
    expect(months[0].topSpending).toEqual([{ name: "Rent", amount: 15000 }]);
  });

  it("keeps an empty month between two that have entries: a statement may be missing", () => {
    const months = monthlyFlow([tx("2026-06-10", "A", -1), tx("2026-09-10", "B", -1)]);
    expect(months.map((m) => [m.month, m.entries])).toEqual([
      ["2026-09", 1],
      ["2026-08", 0],
      ["2026-07", 0],
      ["2026-06", 1],
    ]);
  });

  it("crosses the year correctly and accepts dates with a time", () => {
    const months = monthlyFlow([tx("2025-12-31T10:00:00Z", "A", -1), tx("2026-01-01", "B", -1)]);
    expect(months.map((m) => m.month)).toEqual(["2026-01", "2025-12"]);
  });

  it("ignores rows with no usable date or amount, and copes with nothing", () => {
    expect(monthlyFlow([tx("", "A", -1), tx("not a date", "B", -1), tx("2026-01-01", "C", 0)])).toEqual([]);
    expect(monthlyFlow()).toEqual([]);
  });
});

describe("imported entries past the first 1000", () => {
  it("are all loaded, page by page", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ $id: `d${i}`, name: `ROW ${i}`, type: "debit", amount: 1, date: "2026-01-01" }));
    vi.doMock("@/lib/server/appwrite", () => ({
      createAdminClient: async () => ({
        database: {
          listDocuments: async (_db: string, _col: string, queries: string[]) => {
            const parsed = queries.map((q) => JSON.parse(q));
            const limit = parsed.find((q) => q.method === "limit").values[0];
            const after = parsed.find((q) => q.method === "cursorAfter")?.values?.[0];
            const start = after ? all.findIndex((d) => d.$id === after) + 1 : 0;
            return { documents: all.slice(start, start + limit), total: all.length };
          },
        },
      }),
    }));
    const { getStatementTransactions } = await import("@/lib/providers/manual");
    const rows = await getStatementTransactions({ $id: "big-bank", accountId: "a", currency: "INR" } as Bank);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
  });
});
