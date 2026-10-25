import { beforeEach, describe, expect, it, vi } from "vitest";

// "Salaried" is saved only for a salary credit the person confirmed or picked, and only
// when that credit is in their own statements: checked on the server, whatever the page sends.
const state = vi.hoisted(() => ({
  user: { $id: "profile-1", firstName: "Aaditya", lastName: "Pandey" } as Record<string, string> | null,
  prefs: {} as Record<string, unknown>,
  transactions: [] as Transaction[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/i18n/server", () => ({ getT: async () => (key: string) => key }));
vi.mock("@/lib/server/rateLimit", () => ({ allow: async () => true, MINUTE: 60_000 }));
vi.mock("@/lib/server/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getLoggedInUser: async () => state.user, ownerIdOf: (u: { $id: string }) => u.$id }));
vi.mock("@/lib/server/prefs", () => ({
  readPrefs: async () => JSON.parse(JSON.stringify(state.prefs)),
  updatePrefs: async (_owner: string, change: Record<string, unknown>) => {
    state.prefs = { ...state.prefs, ...JSON.parse(JSON.stringify(change)) };
    return state.prefs;
  },
}));
vi.mock("@/lib/server/ownerAccounts", () => ({
  ownerAccounts: async () => [{ id: "bank-1", account: { currency: "INR" }, transactions: state.transactions, regular: [] }],
}));

import { salaryCandidate, setIncome } from "@/lib/actions/income.action";

const row = (date: string, name: string, amount: number, type: "credit" | "debit") => ({ id: `${date}-${name}`, date, name, amount, type }) as Transaction;
const months = ["2026-05", "2026-06", "2026-07", "2026-08"];

beforeEach(() => {
  state.user = { $id: "profile-1", firstName: "Aaditya", lastName: "Pandey" };
  state.prefs = {};
  state.transactions = [
    ...months.map((m) => row(`${m}-28`, "NEFT CR GLOBEX SOLUTIONS PVT LTD", 35000, "credit")),
    ...months.map((m) => row(`${m}-06`, "NETFLIX.COM", 649, "debit")),
    ...months.map((m) => row(`${m}-02`, "IMPS/CR/STATE BANK OF INDIA/AADITYA PANDEY", 20000, "credit")),
  ];
});

describe("salaryCandidate: verify before asking", () => {
  it("offers the likely salary to confirm, and everyone who sent money in to pick from; never a payment out or the person's own transfer", async () => {
    const result = await salaryCandidate();
    if (!result.ok) throw new Error("not ok");
    expect(result.candidates.map((c) => [c.payee, c.confidence])).toEqual([["Globex Solutions", "medium"]]);
    expect(result.candidates[0]).toMatchObject({ monthly: 35000, months: 4, payDay: 28 });
    expect(result.payers.map((p) => p.payee)).toContain("Globex Solutions");
    expect(result.payers.map((p) => p.payee)).not.toContain("Netflix");
  });
});

describe("setIncome: salaried only for a confirmed credit in the statements", () => {
  it("refuses salaried without a confirmed credit", async () => {
    expect(await setIncome({ kind: "salaried" })).toMatchObject({ ok: false, error: "home.incomeEmployerNone" });
    expect(state.prefs.income).toBeUndefined();
  });

  it("refuses a credit that is not in the statements, whatever the page sends", async () => {
    expect(await setIncome({ kind: "salaried", salaryPayee: "Made Up Employer Pvt Ltd", payDay: 1 })).toMatchObject({ ok: false });
    expect(await setIncome({ kind: "salaried", salaryPayee: "Netflix", payDay: 6 })).toMatchObject({ ok: false });
    expect(state.prefs.income).toBeUndefined();
  });

  it("saves the confirmed credit, the pay day, and the ones turned down", async () => {
    expect(await setIncome({ kind: "salaried", salaryPayee: "Globex Solutions", payDay: 28, rejected: ["Some Other Co"] })).toEqual({ ok: true });
    expect(state.prefs.income).toEqual({ kind: "salaried", salaryPayee: "Globex Solutions", excluded: ["Some Other Co"], payDay: 28 });
  });

  it("other kinds need no salary, and keep the answers already given", async () => {
    state.prefs = { income: { kind: "salaried", salaryPayee: "Globex Solutions", excluded: ["X"] } };
    expect(await setIncome({ kind: "student" })).toEqual({ ok: true });
    expect(state.prefs.income).toEqual({ kind: "student", salaryPayee: "Globex Solutions", excluded: ["X"] });
  });

  it("needs a signed-in person", async () => {
    state.user = null;
    expect(await salaryCandidate()).toEqual({ ok: false });
    expect(await setIncome({ kind: "student" })).toMatchObject({ ok: false });
  });
});
