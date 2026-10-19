import "server-only";

import { cache } from "react";

import { applyCorrections } from "../corrections";
import { estimateIncome, isIncomeKind, type IncomeEstimate, type IncomeKind } from "../income";
import { getStatementTransactions, MANUAL_PROVIDER } from "../providers/manual";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";
import { readPrefs } from "./prefs";

export type IncomeSetting = { kind: IncomeKind; declared?: number };

/** How the person said they earn, from their settings; null when never asked (older profiles). */
export const loadIncome = cache(async (ownerId: string): Promise<IncomeSetting | null> => {
  const income = (await readPrefs(ownerId)).income;
  if (!income || typeof income !== "object" || !isIncomeKind(income.kind)) return null;
  const declared = typeof income.declared === "number" && Number.isFinite(income.declared) && income.declared > 0 ? income.declared : undefined;
  return { kind: income.kind, declared };
});

/** Money in each month across every uploaded account, read the way the person earns. */
export async function incomeForOwner(ownerId: string, setting: IncomeSetting): Promise<IncomeEstimate> {
  const [banks, corrections] = await Promise.all([getBanks({ userId: ownerId }), loadCorrections(ownerId)]);
  const transactions = (
    await Promise.all(
      banks
        .filter((bank) => bank.provider === MANUAL_PROVIDER)
        .map(async (bank) => applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[]),
    )
  ).flat();
  return estimateIncome(transactions, setting.kind, setting.declared);
}
