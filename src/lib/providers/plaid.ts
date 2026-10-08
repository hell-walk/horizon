// Plaid adapter: the provider-specific calls behind getAccounts / getAccount.
// Everything here returns the app's own Account / Transaction shapes so pages and
// components never see raw Plaid objects. The Setu adapter mirrors this file.

import { CountryCode } from "plaid";

import { plaidClient } from "../plaid";
import { cached, TTL } from "../cache";

export const PLAID_PROVIDER = "plaid" as const;

/** Account data for one Plaid item, cached for a minute. */
export const getPlaidAccountsData = (accessToken: string) =>
  cached(`plaid:accounts:${accessToken}`, TTL.minute, async () => {
    const response = await plaidClient.accountsGet({ access_token: accessToken });
    return response.data;
  });

/** Institution details never change, so they are cached for a day. */
export const getPlaidInstitution = (institutionId: string) =>
  cached(`plaid:institution:${institutionId}`, TTL.day, async () => {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });
    return response.data.institution;
  });

/** Maps a Plaid item into the app's Account shape. */
export async function toPlaidAccount(bank: Bank): Promise<Account> {
  const data = await getPlaidAccountsData(bank.accessToken);
  const accountData = data.accounts[0];
  const institution = await getPlaidInstitution(data.item.institution_id!);

  return {
    id: accountData.account_id,
    availableBalance: accountData.balances.available!,
    currentBalance: accountData.balances.current!,
    institutionId: institution.institution_id,
    name: accountData.name,
    officialName: accountData.official_name ?? accountData.name,
    mask: accountData.mask!,
    type: accountData.type as string,
    subtype: accountData.subtype! as string,
    appwriteItemId: bank.$id,
    sharableId: bank.sharableId,
    currency: accountData.balances.iso_currency_code ?? "USD",
    provider: PLAID_PROVIDER,
  };
}

/** Every transaction on the item via /transactions/sync, cached for a minute. */
export const getPlaidTransactions = (accessToken: string, currency = "USD") =>
  cached(`plaid:transactions:${accessToken}`, TTL.minute, async () => {
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let transactions: Transaction[] = [];

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
        type: transaction.amount > 0 ? "debit" : "credit",
        accountId: transaction.account_id,
        amount: Math.abs(transaction.amount),
        pending: transaction.pending,
        category: transaction.category ? transaction.category[0] : "",
        date: transaction.date,
        image: transaction.logo_url,
        currency: transaction.iso_currency_code ?? currency,
      })) as unknown as Transaction[];

      transactions = [...transactions, ...added];
      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    return transactions;
  });
