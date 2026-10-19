import "server-only";

import { cache } from "react";

import { applyCorrections } from "../corrections";
import { estimateIncome, isIncomeKind, type IncomeEstimate, type IncomeKind } from "../income";
import { getStatementTransactions, MANUAL_PROVIDER } from "../providers/manual";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";
import { readPrefs } from "./prefs";

export type IncomeSetting = { kind: IncomeKind; declared?: number; salaryPayee?: string; excluded?: string[]; side?: number };

/** How the person said they earn, from their settings; null when never asked (older profiles). */
export const loadIncome = cache(async (ownerId: string): Promise<IncomeSetting | null> => {
  const income = (await readPrefs(ownerId)).income;
  if (!income || typeof income !== "object" || !isIncomeKind(income.kind)) return null;
  const declared = typeof income.declared === "number" && Number.isFinite(income.declared) && income.declared > 0 ? income.declared : undefined;
  const salaryPayee = typeof income.salaryPayee === "string" && income.salaryPayee.length <= 80 ? income.salaryPayee : undefined;
  const excluded = Array.isArray(income.excluded) ? income.excluded.filter((p): p is string => typeof p === "string" && p.length <= 80).slice(-20) : undefined;
  const side = typeof income.side === "number" && Number.isFinite(income.side) && income.side > 0 ? income.side : undefined;
  return { kind: income.kind, declared, salaryPayee, excluded, side };
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
  return estimateIncome(transactions, setting.kind, setting.declared, { prefer: setting.salaryPayee, exclude: setting.excluded }, setting.side);
}
