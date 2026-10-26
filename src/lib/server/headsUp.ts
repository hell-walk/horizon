import "server-only";

import { headsUp, type HeadsUpResult } from "../finance/headsUp";
import { findRegular } from "../finance/recurring";
import { getAccount, getAccounts } from "./accounts";

/**
 * "Be prepared" across all of a user's accounts. Each account is read through
 * getAccount (deduped per request: Home's other panels ask for the same).
 */
export async function headsUpFor(ownerId: string, today = new Date()): Promise<HeadsUpResult> {
  const accounts = ((await getAccounts({ userId: ownerId }))?.data as Account[] | undefined) ?? [];
  const inputs = await Promise.all(
    accounts.map(async (a) => {
      const transactions = ((await getAccount({ appwriteItemId: a.appwriteItemId }))?.transactions as Transaction[] | undefined) ?? [];
      return {
        account: { id: a.appwriteItemId, name: a.name, mask: a.mask, currency: a.currency ?? "INR" },
        balance: a.balanceUnknown ? null : a.currentBalance,
        transactions,
        regular: findRegular(transactions, today),
      };
    }),
  );
  return headsUp(inputs, today);
}
