// Sending money runs on Dwolla, which only moves US dollars between US bank
// accounts linked through Plaid. Everything about transfers (the receiving
// code, the "Send money" button) shows only on accounts that can take part;
// the server checks the same rule again (transfer.action.ts).

/** Can this account send or receive money through Horizon? */
export const canTransfer = (account: Pick<Account, "provider" | "currency">) =>
  (account.provider ?? "plaid") === "plaid" && (account.currency || "USD") === "USD";
