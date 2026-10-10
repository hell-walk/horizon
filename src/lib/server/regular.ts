import "server-only";

import { findRegular, type Regular } from "../recurring";
import { getAccount, getAccounts } from "./accounts";

export type RegularWithAccount = Regular & { account: { id: string; name: string; mask: string; currency: string } };

/**
 * Regular payments across all of a user's accounts, the soonest first. Each
 * account is read through getAccount (deduped per request, with the user's
 * own names and categories applied).
 */
export async function regularPayments(ownerId: string, today = new Date()): Promise<RegularWithAccount[]> {
  const accounts = (await getAccounts({ userId: ownerId }))?.data as Account[] | undefined;
  if (!accounts?.length) return [];

  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const loaded = await getAccount({ appwriteItemId: a.appwriteItemId });
      const account = { id: a.appwriteItemId, name: a.name, mask: a.mask, currency: a.currency ?? "INR" };
      return findRegular((loaded?.transactions as Transaction[] | undefined) ?? [], today).map((r) => ({ ...r, key: `${a.appwriteItemId}|${r.key}`, account }));
    }),
  );
  return perAccount.flat().sort((a, b) => a.next.localeCompare(b.next));
}
