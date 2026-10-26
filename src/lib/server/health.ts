import "server-only";

import { cache } from "react";

import { healthScore, type Health } from "../finance/health";
import { incomeForOwner, loadIncome } from "./income";
import { ownerAccounts } from "./ownerAccounts";

/** The health score for one person, from every uploaded account. Once per request. */
export const healthForOwner = cache(async (ownerId: string): Promise<Health> => {
  const [loaded, setting] = await Promise.all([ownerAccounts(ownerId), loadIncome(ownerId)]);
  const accounts = loaded.map(({ account, transactions, regular }) => ({
    transactions,
    regular,
    balance: account.balanceUnknown ? null : account.currentBalance,
  }));
  const known = accounts.filter((a) => a.balance !== null);
  const income = setting ? (await incomeForOwner(ownerId, setting)).monthly : null;
  return healthScore({
    transactions: accounts.flatMap((a) => a.transactions),
    regular: accounts.flatMap((a) => a.regular),
    income,
    balance: known.length ? known.reduce((s, a) => s + (a.balance ?? 0), 0) : null,
  });
});
