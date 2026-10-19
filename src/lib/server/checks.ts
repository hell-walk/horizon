import "server-only";

import { cache } from "react";

import { findChecks, type Check } from "../checks";
import { loadIncome } from "./income";
import { ownerAccounts } from "./ownerAccounts";
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
  const [loaded, income, state] = await Promise.all([ownerAccounts(ownerId), loadIncome(ownerId), loadChecksState(ownerId)]);
  const accounts = loaded.map(({ id, account, transactions, regular }) => ({
    id,
    name: account.name,
    mask: account.mask,
    currency: account.currency,
    transactions,
    regular,
  }));
  return findChecks({
    accounts,
    person,
    incomeKind: income?.kind ?? null,
    salaryPrefer: income?.salaryPayee,
    salaryExclude: income?.excluded,
    answered: state.answered,
  });
}
