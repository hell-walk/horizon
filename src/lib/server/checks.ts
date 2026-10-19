import "server-only";

import { cache } from "react";

import { findChecks, type Check } from "../checks";
import { applyCorrections } from "../corrections";
import { getStatementTransactions, MANUAL_PROVIDER, toManualAccount } from "../providers/manual";
import { findRegular } from "../recurring";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";
import { loadIncome } from "./income";
import { readPrefs } from "./prefs";

/** How many questions someone who has not subscribed can answer, in all. */
export const FREE_CHECKS = 3;
const MAX_ANSWERED = 300;

export type ChecksState = { answered: string[]; used: number };

/** What has been asked and answered so far, read defensively. */
export const loadChecksState = cache(async (ownerId: string): Promise<ChecksState> => {
  const raw = (await readPrefs(ownerId)).checks as { answered?: unknown; used?: unknown } | undefined;
  const answered = Array.isArray(raw?.answered) ? raw!.answered.filter((k): k is string => typeof k === "string" && k.length <= 200).slice(-MAX_ANSWERED) : [];
  const used = typeof raw?.used === "number" && Number.isFinite(raw.used) && raw.used >= 0 ? Math.floor(raw.used) : 0;
  return { answered, used };
});

/** The state after one more answer. */
export const withAnswer = (state: ChecksState, key: string): ChecksState => ({
  answered: [...state.answered.filter((k) => k !== key), key].slice(-MAX_ANSWERED),
  used: state.used + 1,
});

/** The questions worth asking this person now, from every uploaded account. */
export async function checksForOwner(ownerId: string, person: { firstName?: string; lastName?: string }): Promise<Check[]> {
  const [banks, corrections, income, state] = await Promise.all([
    getBanks({ userId: ownerId }),
    loadCorrections(ownerId),
    loadIncome(ownerId),
    loadChecksState(ownerId),
  ]);
  const today = new Date();
  const accounts = await Promise.all(
    banks
      .filter((bank) => bank.provider === MANUAL_PROVIDER)
      .map(async (bank) => {
        const account = toManualAccount(bank);
        const transactions = applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[];
        return { id: bank.$id, name: account.name, mask: account.mask, currency: account.currency, transactions, regular: findRegular(transactions, today) };
      }),
  );
  return findChecks({
    accounts,
    person,
    incomeKind: income?.kind ?? null,
    salaryPrefer: income?.salaryPayee,
    salaryExclude: income?.excluded,
    answered: state.answered,
  });
}
