import "server-only";

import { cache } from "react";

import { applyCorrections } from "../corrections";
import { healthScore, type Health } from "../health";
import { getStatementTransactions, MANUAL_PROVIDER, toManualAccount } from "../providers/manual";
import { findRegular } from "../recurring";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";
import { incomeForOwner, loadIncome } from "./income";

/** The health score for one person, from every uploaded account. Once per request. */
export const healthForOwner = cache(async (ownerId: string): Promise<Health> => {
  const [banks, corrections, setting] = await Promise.all([getBanks({ userId: ownerId }), loadCorrections(ownerId), loadIncome(ownerId)]);
  const today = new Date();
  const accounts = await Promise.all(
    banks
      .filter((bank) => bank.provider === MANUAL_PROVIDER)
      .map(async (bank) => {
        const account = toManualAccount(bank);
        const transactions = applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[];
        return { transactions, regular: findRegular(transactions, today), balance: account.balanceUnknown ? null : account.currentBalance };
      }),
  );
  const known = accounts.filter((a) => a.balance !== null);
  const income = setting ? (await incomeForOwner(ownerId, setting)).monthly : null;
  return healthScore({
    transactions: accounts.flatMap((a) => a.transactions),
    regular: accounts.flatMap((a) => a.regular),
    income,
    balance: known.length ? known.reduce((s, a) => s + (a.balance ?? 0), 0) : null,
  });
});
