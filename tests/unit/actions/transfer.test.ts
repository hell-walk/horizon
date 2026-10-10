import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything around the action is mocked: who is signed in, the bank rows,
// Dwolla and the transfer record. The action's own checks are what is tested.
const state = vi.hoisted(() => ({ user: null as null | { $id: string }, ownedBy: new Map<string, string>() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/auth")>();
  return {
    ...real,
    requireUser: vi.fn(async () => {
      if (!state.user) throw new real.NotSignedInError();
      return state.user;
    }),
  };
});

const banks: Record<string, Partial<Bank>> = {
  "bank-mine": { $id: "bank-mine", userId: "", provider: "plaid", currency: "USD", fundingSourceUrl: "https://dwolla/fs/mine" },
  "bank-mine-inr": { $id: "bank-mine-inr", userId: "", provider: "manual", currency: "INR", fundingSourceUrl: "" },
  "bank-theirs": { $id: "bank-theirs", userId: "someone-else", provider: "plaid", currency: "USD", fundingSourceUrl: "https://dwolla/fs/theirs" },
};
vi.mock("@/lib/server/banks", () => ({
  getOwnBank: vi.fn(async (owner: string, id: string) => {
    const bank = banks[id];
    const realOwner = state.ownedBy.get(id) ?? bank?.userId;
    return bank && realOwner === owner ? ({ ...bank, userId: realOwner } as Bank) : null;
  }),
  getBankBySharableId: vi.fn(async (sharable: string) =>
    sharable === "share-theirs" ? (banks["bank-theirs"] as Bank) : sharable === "share-mine" ? ({ ...banks["bank-mine"], userId: state.user?.$id } as Bank) : null
  ),
}));
vi.mock("@/lib/server/dwolla", () => ({ createTransfer: vi.fn() }));
vi.mock("@/lib/server/transactions", () => ({ createTransaction: vi.fn() }));

const { sendTransfer } = await import("@/lib/actions/transfer.action");
const { createTransfer } = await import("@/lib/server/dwolla");
const { createTransaction } = await import("@/lib/server/transactions");

let n = 0;
const signIn = () => {
  const id = `user-${++n}`; // fresh user per test, so per-user rate limits do not leak between tests
  state.user = { $id: id };
  state.ownedBy.set("bank-mine", id);
  state.ownedBy.set("bank-mine-inr", id);
  return id;
};
const key = () => crypto.randomUUID();
const valid = () => ({ senderBank: "bank-mine", sharableId: "share-theirs", amount: "25.50", name: "Dinner split", email: "friend@example.com", idempotencyKey: key() });

beforeEach(() => {
  vi.mocked(createTransfer).mockReset().mockResolvedValue("https://api-sandbox.dwolla.com/transfers/t-1");
  vi.mocked(createTransaction).mockReset().mockResolvedValue({ $id: "record-1" });
  signIn();
});

describe("sendTransfer: who may send", () => {
  it("refuses when nobody is signed in", async () => {
    state.user = null;
    expect(await sendTransfer(valid())).toEqual({ ok: false, error: "You need to be signed in." });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("refuses to send from someone else's account, with the same answer as a missing one", async () => {
    const theirs = await sendTransfer({ ...valid(), senderBank: "bank-theirs" });
    const missing = await sendTransfer({ ...valid(), senderBank: "no-such-bank" });
    expect(theirs).toMatchObject({ ok: false, field: "senderBank" });
    expect(missing).toEqual(theirs); // no hint that the id exists
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("refuses an account that cannot move dollars (manual, INR)", async () => {
    expect(await sendTransfer({ ...valid(), senderBank: "bank-mine-inr" })).toMatchObject({ ok: false, field: "senderBank" });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("refuses an unknown recipient and sending to the same account", async () => {
    expect(await sendTransfer({ ...valid(), sharableId: "nope" })).toMatchObject({ ok: false, field: "sharableId" });
    expect(await sendTransfer({ ...valid(), sharableId: "share-mine" })).toMatchObject({ ok: false, field: "sharableId" });
    expect(createTransfer).not.toHaveBeenCalled();
  });
});

describe("sendTransfer: input validation (the browser's checks do not count)", () => {
  it.each(["0", "-5", "1.234", "abc", "1e3", "10000.01", "", " ", "NaN", "Infinity", "0x10"])("rejects amount %j", async (amount) => {
    expect(await sendTransfer({ ...valid(), amount })).toMatchObject({ ok: false, field: "amount" });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it.each(["", "abc", "a@b", "not an email"])("rejects email %j", async (email) => {
    expect(await sendTransfer({ ...valid(), email })).toMatchObject({ ok: false, field: "email" });
  });

  it("rejects a missing or malformed idempotency key", async () => {
    expect(await sendTransfer({ ...valid(), idempotencyKey: "" })).toMatchObject({ ok: false });
    expect(await sendTransfer({ ...valid(), idempotencyKey: "../../etc" })).toMatchObject({ ok: false });
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("survives garbage input without throwing", async () => {
    // @ts-expect-error: deliberately wrong shapes, as an attacker would send
    expect(await sendTransfer(null)).toMatchObject({ ok: false });
    // @ts-expect-error: deliberately wrong shapes
    expect(await sendTransfer({ amount: { toString: () => "5" }, idempotencyKey: key() })).toMatchObject({ ok: false });
  });
});

describe("sendTransfer: money moves once", () => {
  it("sends with the key and records ids the server looked up, not ones the browser sent", async () => {
    const input = valid();
    expect(await sendTransfer(input)).toEqual({ ok: true });
    expect(createTransfer).toHaveBeenCalledWith({
      sourceFundingSourceUrl: "https://dwolla/fs/mine",
      destinationFundingSourceUrl: "https://dwolla/fs/theirs",
      amount: "25.50",
      idempotencyKey: input.idempotencyKey,
    });
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: state.user!.$id, senderBankId: "bank-mine", receiverId: "someone-else", receiverBankId: "bank-theirs" })
    );
  });

  it("answers a repeat of the same request without sending again", async () => {
    const input = valid();
    const first = await sendTransfer(input);
    const second = await sendTransfer(input);
    expect(second).toEqual(first);
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("refuses a duplicate that arrives while the first is still in flight", async () => {
    let release!: (url: string) => void;
    vi.mocked(createTransfer).mockImplementationOnce(() => new Promise((r) => (release = r)));
    const input = valid();
    const first = sendTransfer(input);
    await vi.waitFor(() => expect(createTransfer).toHaveBeenCalledTimes(1));
    expect(await sendTransfer(input)).toEqual({ ok: false, error: "This transfer is already being sent." });
    release("https://api-sandbox.dwolla.com/transfers/t-2");
    expect(await first).toEqual({ ok: true });
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("keeps keys per user: another user's key cannot replay a result", async () => {
    const input = valid();
    await sendTransfer(input);
    signIn();
    await sendTransfer(input); // same key, different user: a separate transfer
    expect(createTransfer).toHaveBeenCalledTimes(2);
  });

  it("says so when the money moved but the record could not be saved", async () => {
    vi.mocked(createTransaction).mockResolvedValueOnce(null);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendTransfer(valid());
    expect(result).toMatchObject({ ok: true, warning: expect.stringMatching(/do not send it again/) });
    expect(errors.mock.calls.flat().join(" ")).toContain("t-1"); // Dwolla id kept for reconciliation
    errors.mockRestore();
  });

  it("does not retry a declined transfer under the same key", async () => {
    vi.mocked(createTransfer).mockResolvedValueOnce(undefined);
    const input = valid();
    expect(await sendTransfer(input)).toMatchObject({ ok: false, error: expect.stringMatching(/declined/) });
    expect(await sendTransfer(input)).toMatchObject({ ok: false, error: expect.stringMatching(/declined/) });
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("limits one user to 10 transfers per 10 minutes", async () => {
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await sendTransfer(valid()));
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true);
    expect(results[10]).toMatchObject({ ok: false, error: expect.stringMatching(/Too many transfers/) });
    expect(createTransfer).toHaveBeenCalledTimes(10);
  });
});
