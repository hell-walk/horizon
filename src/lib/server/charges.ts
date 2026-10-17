import "server-only";

import { findCharges, type ChargeReport } from "../charges";
import { getAccount, getAccounts } from "./accounts";

export type AccountCharges = { account: { id: string; name: string; mask: string; currency: string }; report: ChargeReport };

/**
 * Bank charges for each of a user's accounts that has entries, the largest
 * total first. Each account is read through getAccount (deduped per request,
 * so Home asking for this next to the bills costs no extra trip).
 */
export async function bankCharges(ownerId: string): Promise<AccountCharges[]> {
  const accounts = (await getAccounts({ userId: ownerId }))?.data as Account[] | undefined;
  if (!accounts?.length) return [];

  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const loaded = await getAccount({ appwriteItemId: a.appwriteItemId });
      const report = findCharges((loaded?.transactions as Transaction[] | undefined) ?? []);
      return report ? { account: { id: a.appwriteItemId, name: a.name, mask: a.mask, currency: a.currency ?? "INR" }, report } : null;
    }),
  );
  return perAccount.filter((a): a is AccountCharges => a !== null).sort((a, b) => b.report.total - a.report.total);
}
