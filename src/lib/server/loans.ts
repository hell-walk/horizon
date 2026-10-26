import "server-only";

import { findLoans, type AccountInput, type LoanReport } from "../finance/loans";
import { findRegular } from "../finance/recurring";
import { getAccount, getAccounts } from "./accounts";

/**
 * Every lender across a user's accounts. Each account is read through
 * getAccount (deduped per request, with the user's own names and categories
 * applied, so an entry they moved out of "EMI & pay later" stays out).
 */
export async function loanPicture(ownerId: string, today = new Date()): Promise<LoanReport> {
  const accounts = ((await getAccounts({ userId: ownerId }))?.data as Account[] | undefined) ?? [];
  const inputs: AccountInput[] = await Promise.all(
    accounts.map(async (a) => {
      const transactions = ((await getAccount({ appwriteItemId: a.appwriteItemId }))?.transactions as Transaction[] | undefined) ?? [];
      return { currency: a.currency ?? "INR", transactions, regular: findRegular(transactions, today) };
    }),
  );
  return findLoans(inputs);
}
