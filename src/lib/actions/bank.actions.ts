"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";

import { cache } from "react";

import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";
import { cached, TTL } from "../cache";

import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.action";

// Plaid account data for one item. Shared by getAccounts and getAccount and cached
// for a minute so navigating between pages does not hit Plaid every time.
const getPlaidAccounts = (accessToken: string) =>
  cached(`plaid:accounts:${accessToken}`, TTL.minute, async () => {
    const response = await plaidClient.accountsGet({ access_token: accessToken });
    return response.data;
  });

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    // get banks from db
    const banks = await getBanks({ userId });

    const accounts = await Promise.all(
      banks?.map(async (bank: Bank) => {
        // get each account info from plaid
        const accountsData = await getPlaidAccounts(bank.accessToken);
        const accountData = accountsData.accounts[0];

        // get institution info from plaid
        const institution = await getInstitution({
          institutionId: accountsData.item.institution_id!,
        });

        const account = {
          id: accountData.account_id,
          availableBalance: accountData.balances.available!,
          currentBalance: accountData.balances.current!,
          institutionId: institution.institution_id,
          name: accountData.name,
          officialName: accountData.official_name,
          mask: accountData.mask!,
          type: accountData.type as string,
          subtype: accountData.subtype! as string,
          appwriteItemId: bank.$id,
          sharableId: bank.sharableId,
        };

        return account;
      })
    );

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce((total, account) => {
      return total + account.currentBalance;
    }, 0);

    return parseStringify({ data: accounts, totalBanks, totalCurrentBalance });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get one bank account. cache() dedupes it within a request: the transactions list
// and the right sidebar both need it.
const loadAccount = cache(async (appwriteItemId: string) => {
  try {
    // get bank from db
    const bank = await getBank({ documentId: appwriteItemId });
    if (!bank) {
      console.error("No bank found for id", appwriteItemId);
      return null;
    }

    // Plaid balances, Plaid transactions and Appwrite transfers are independent: fetch them together.
    const [accountsData, transferTransactionsData, transactions] = await Promise.all([
      getPlaidAccounts(bank.accessToken),
      getTransactionsByBankId({ bankId: bank.$id }),
      getTransactions({ accessToken: bank.accessToken }),
    ]);
    const accountData = accountsData.accounts[0];

    const transferTransactions = (transferTransactionsData?.documents ?? []).map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: transferData.amount!,
        date: transferData.$createdAt,
        paymentChannel: transferData.channel,
        category: transferData.category,
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
      })
    );

    // get institution info from plaid
    const institution = await getInstitution({
      institutionId: accountsData.item.institution_id!,
    });

    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type as string,
      subtype: accountData.subtype! as string,
      appwriteItemId: bank.$id,
    };

    // sort transactions by date such that the most recent transaction is first
      const allTransactions = [...transactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
  }
});

export const getAccount = async ({ appwriteItemId }: getAccountProps) => loadAccount(appwriteItemId);

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    // Institution details never change, so cache them for a day.
    const intitution = await cached(`plaid:institution:${institutionId}`, TTL.day, async () => {
      const response = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: ["US"] as CountryCode[],
      });
      return response.data.institution;
    });

    return parseStringify(intitution);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get transactions
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  try {
    const transactions = await cached(`plaid:transactions:${accessToken}`, TTL.minute, async () => {
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let transactions: any[] = [];

    // Walk every page of the sync feed; the cursor marks where the last page ended.
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const data = response.data;

      const added = data.added.map((transaction) => ({
        id: transaction.transaction_id,
        name: transaction.name,
        paymentChannel: transaction.payment_channel,
        // Plaid reports outflows as positive amounts and inflows as negative ones.
        type: transaction.amount > 0 ? 'debit' : 'credit',
        accountId: transaction.account_id,
        amount: Math.abs(transaction.amount),
        pending: transaction.pending,
        category: transaction.category ? transaction.category[0] : "",
        date: transaction.date,
        image: transaction.logo_url,
      }));

      transactions = [...transactions, ...added];
      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    return transactions;
    });

    return parseStringify(transactions);
  } catch (error) {
    console.error("An error occurred while getting transactions:", error);
    return [];
  }
};