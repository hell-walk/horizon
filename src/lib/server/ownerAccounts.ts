import "server-only";

import { cache } from "react";

import { applyCorrections } from "../corrections";
import { getStatementTransactions, MANUAL_PROVIDER, toManualAccount } from "../providers/manual";
import { findRegular, type Regular } from "../recurring";
import { getBanks } from "./banks";
import { loadCorrections } from "./corrections";

export type OwnerAccount = {
  /** The bank row's id. */
  id: string;
  account: Account;
  /** With the person's own names and categories applied. */
  transactions: Transaction[];
  regular: Regular[];
};

/**
 * Every uploaded account of one person, with their corrections applied and the
 * regular payments found: once per request, however many panels on the page
 * need it. Health, the report, money in, the questions and the loans all read
 * this rather than each loading and sorting the same entries again.
 */
export const ownerAccounts = cache(async (ownerId: string): Promise<OwnerAccount[]> => {
  const [banks, corrections] = await Promise.all([getBanks({ userId: ownerId }), loadCorrections(ownerId)]);
  const today = new Date();
  return Promise.all(
    banks
      .filter((bank) => bank.provider === MANUAL_PROVIDER)
      .map(async (bank) => {
        const account = toManualAccount(bank);
        const transactions = applyCorrections((await getStatementTransactions(bank)) as Transaction[], corrections) as Transaction[];
        return { id: bank.$id, account, transactions, regular: findRegular(transactions, today) };
      }),
  );
});
