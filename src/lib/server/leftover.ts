import "server-only";

import { cached, TTL } from "../cache";
import { monthlyFlow } from "../cashflow";
import type { UsualLeftOver } from "../goals";
import { getAccount, getAccounts } from "./accounts";

const MONTHS = 3;

/**
 * What a user usually has left over in a month (money in minus money out,
 * moves between their own accounts left out), per currency: the average of
 * the last three months the statements fully cover, all accounts together.
 * A month is left out when it is still running, or when the statements start
 * after its 3rd or end before its 25th.
 */
export const usualLeftOver = (ownerId: string, today = new Date()): Promise<UsualLeftOver[]> =>
  // Reads every account, so it is kept for a few minutes. The key starts with "banks:", so
  // an import or a removed bank (which clear "banks:") clears it too.
  cached(`banks:leftover:${ownerId}`, 5 * TTL.minute, () => work(ownerId, today));

async function work(ownerId: string, today: Date): Promise<UsualLeftOver[]> {
  const accounts = ((await getAccounts({ userId: ownerId }))?.data as Account[] | undefined) ?? [];
  const thisMonth = today.toISOString().slice(0, 7);
  const byCurrency = new Map<string, Map<string, number>>();

  for (const a of accounts) {
    const loaded = await getAccount({ appwriteItemId: a.appwriteItemId });
    const months = monthlyFlow((loaded?.transactions as Transaction[] | undefined) ?? []).filter((m) => m.entries > 0);
    if (months.length === 0) continue;
    const newest = months[0];
    const oldest = months[months.length - 1];
    const totals = byCurrency.get(a.currency ?? "INR") ?? new Map<string, number>();
    for (const m of months) {
      if (m.month >= thisMonth) continue;
      if (m === oldest && Number(m.from?.slice(8, 10)) > 3) continue;
      if (m === newest && Number(m.to?.slice(8, 10)) < 25) continue;
      totals.set(m.month, (totals.get(m.month) ?? 0) + m.left);
    }
    byCurrency.set(a.currency ?? "INR", totals);
  }

  const out: UsualLeftOver[] = [];
  for (const [currency, totals] of byCurrency) {
    const months = [...totals.keys()].sort().slice(-MONTHS);
    if (months.length < 2) continue;
    out.push({ currency, amount: Math.round((months.reduce((s, m) => s + totals.get(m)!, 0) / months.length) * 100) / 100, months });
  }
  return out;
}
