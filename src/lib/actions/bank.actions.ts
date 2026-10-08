"use server";

import { cache } from "react";

import { parseStringify } from "../utils";
import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.action";
import { saveSetuSessionId } from "./setu.action";
import {
  getPlaidInstitution,
  getPlaidTransactions,
  toPlaidAccount,
} from "../providers/plaid";
import {
  findSessionAccount,
  institutionName,
  loadSessionForConsent,
  SETU_PROVIDER,
  toAccount as toSetuAccount,
  toTransactions as toSetuTransactions,
} from "../providers/setu";

// Every bank row carries a provider; rows created before the column existed are Plaid.
const providerOf = (bank: Bank) => (bank.provider === SETU_PROVIDER ? SETU_PROVIDER : "plaid");

/* ------------------------------------------------------------------ */
/* Provider-neutral account loading                                    */
/* ------------------------------------------------------------------ */

/** Account + transactions for one Setu bank row (one linked account under a consent). */
async function loadSetuAccount(bank: Bank) {
  const session = await loadSessionForConsent(bank.bankId, bank.dataSessionId, (sessionId) =>
    saveSetuSessionId({ consentId: bank.bankId, sessionId })
  );

  const match = findSessionAccount(session, bank.accountId);
  if (!match) {
    console.warn(`[setu] account ${bank.accountId} not in session ${session.id} (status ${session.status})`);
    return null;
  }

  const account = toSetuAccount({ fipId: match.fipId, account: match.account, bank });
  const transactions = toSetuTransactions(match.account, account.currency);
  return { account, transactions };
}

/** Account for any bank row, whichever provider it came from. */
async function loadAccountForBank(bank: Bank): Promise<Account | null> {
  try {
    if (providerOf(bank) === SETU_PROVIDER) {
      const loaded = await loadSetuAccount(bank);
      return loaded?.account ?? null;
    }
    return await toPlaidAccount(bank);
  } catch (error) {
    console.error(`An error occurred while loading bank ${bank.$id} (${providerOf(bank)}):`, error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public actions used by the pages                                    */
/* ------------------------------------------------------------------ */

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    const banks: Bank[] = (await getBanks({ userId })) ?? [];

    const accounts = (await Promise.all(banks.map(loadAccountForBank))).filter(
      (account): account is Account => account !== null
    );

    const totalBanks = accounts.length;

    // Balances in different currencies cannot be added together, so total per currency.
    const totalsByCurrency = accounts.reduce<Record<string, number>>((totals, account) => {
      const currency = account.currency || "USD";
      totals[currency] = (totals[currency] ?? 0) + account.currentBalance;
      return totals;
    }, {});

    // Kept for existing callers: the total in the first account's currency.
    const primaryCurrency = accounts[0]?.currency ?? "USD";
    const totalCurrentBalance = totalsByCurrency[primaryCurrency] ?? 0;

    return parseStringify({ data: accounts, totalBanks, totalCurrentBalance, totalsByCurrency, primaryCurrency });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get one bank account. cache() dedupes it within a request: the transactions list
// and the right sidebar both need it.
const loadAccount = cache(async (appwriteItemId: string) => {
  try {
    const bank: Bank | undefined = await getBank({ documentId: appwriteItemId });
    if (!bank) {
      console.error("No bank found for id", appwriteItemId);
      return null;
    }

    // Transfers made inside Horizon live in Appwrite regardless of provider.
    const transfersPromise = getTransactionsByBankId({ bankId: bank.$id });

    let account: Account;
    let providerTransactions: Transaction[];

    if (providerOf(bank) === SETU_PROVIDER) {
      const loaded = await loadSetuAccount(bank);
      if (!loaded) return null;
      account = loaded.account;
      providerTransactions = loaded.transactions as unknown as Transaction[];
    } else {
      // Plaid balances and Plaid transactions are independent: fetch them together.
      const [plaidAccount, plaidTransactions] = await Promise.all([
        toPlaidAccount(bank),
        getPlaidTransactions(bank.accessToken),
      ]);
      account = plaidAccount;
      providerTransactions = plaidTransactions;
    }

    const transferTransactionsData = await transfersPromise;
    const transferTransactions = (transferTransactionsData?.documents ?? []).map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: transferData.amount!,
        date: transferData.$createdAt,
        paymentChannel: transferData.channel,
        category: transferData.category,
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
        currency: account.currency,
      })
    );

    // Most recent first.
    const allTransactions = [...providerTransactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({ data: account, transactions: allTransactions });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
  }
});

export const getAccount = async ({ appwriteItemId }: getAccountProps) => loadAccount(appwriteItemId);

// Get bank info. Plaid institutions come from Plaid; Setu FIP ids are readable as-is.
export const getInstitution = async ({ institutionId }: getInstitutionProps) => {
  try {
    if (institutionId.endsWith("-fip") || institutionId.startsWith("setu")) {
      return parseStringify({ institution_id: institutionId, name: institutionName(institutionId) });
    }
    const institution = await getPlaidInstitution(institutionId);
    return parseStringify(institution);
  } catch (error) {
    console.error("An error occurred while getting the institution:", error);
  }
};

// Get transactions for a Plaid item (kept for callers that still pass an access token).
export const getTransactions = async ({ accessToken }: getTransactionsProps) => {
  try {
    const transactions = await getPlaidTransactions(accessToken);
    return parseStringify(transactions);
  } catch (error) {
    console.error("An error occurred while getting transactions:", error);
    return [];
  }
};
