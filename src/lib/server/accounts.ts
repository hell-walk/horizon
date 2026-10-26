import "server-only";

import { cache } from "react";

import { parseStringify } from "../utils";
import { applyCorrections } from "../finance/corrections";
import { loadLoggedInUser, ownerIdOf } from "./auth";
import { loadCorrections } from "./corrections";
import { findOwnBank, getBanks, saveSetuSessionId } from "./banks";
import { getTransactionsByBankId } from "./transactions";
import { getPlaidInstitution, getPlaidTransactions, toPlaidAccount } from "../providers/plaid";
import {
  findSessionAccount,
  institutionName as setuInstitutionName,
  loadSessionForConsent,
  SETU_PROVIDER,
  toAccount as toSetuAccount,
  toTransactions as toSetuTransactions,
} from "../providers/setu";
import { getRecentStatementTransactions, getStatementTransactions, MANUAL_PROVIDER, RECENT_ENTRIES, toManualAccount } from "../providers/manual";
import { logError } from "./log";

// Three ways a bank can be linked:
//   plaid  - Plaid Link (US banks; sandbox for the demo)
//   setu   - Setu Account Aggregator (Indian banks; sandbox for the demo)
//   manual - a statement export imported by the user (real data, stays in-app)
// Rows created before the provider column existed are Plaid.
const providerOf = (bank: Bank): BankProvider =>
  bank.provider === SETU_PROVIDER || bank.provider === MANUAL_PROVIDER ? bank.provider : "plaid";

/* ------------------------------------------------------------------ */
/* Provider-specific loaders, all returning the app's own shapes       */
/* ------------------------------------------------------------------ */

async function loadSetu(bank: Bank) {
  const session = await loadSessionForConsent(bank.bankId, bank.dataSessionId, (sessionId) =>
    saveSetuSessionId({ consentId: bank.bankId, sessionId })
  );

  const match = findSessionAccount(session, bank.accountId);
  if (!match) {
    console.warn(`[setu] account ${bank.accountId} not in session ${session.id} (status ${session.status})`);
    return null;
  }

  const account = toSetuAccount({ fipId: match.fipId, account: match.account, bank });
  const transactions = toSetuTransactions(match.account, account.currency) as unknown as Transaction[];
  return { account, transactions };
}

async function loadManual(bank: Bank) {
  const account = toManualAccount(bank);
  const transactions = await getStatementTransactions(bank);
  return { account, transactions };
}

async function loadPlaid(bank: Bank) {
  // Plaid balances and Plaid transactions are independent: fetch them together.
  const [account, transactions] = await Promise.all([
    toPlaidAccount(bank),
    getPlaidTransactions(bank.accessToken),
  ]);
  return { account, transactions };
}

/** Account + transactions for any bank row. */
async function loadBank(bank: Bank) {
  switch (providerOf(bank)) {
    case SETU_PROVIDER:
      return loadSetu(bank);
    case MANUAL_PROVIDER:
      return loadManual(bank);
    default:
      return loadPlaid(bank);
  }
}

/** Account only (no transactions) for the overview; cheaper for Plaid. */
async function loadAccountOnly(bank: Bank): Promise<Account | null> {
  try {
    switch (providerOf(bank)) {
      case SETU_PROVIDER:
        return (await loadSetu(bank))?.account ?? null;
      case MANUAL_PROVIDER:
        return toManualAccount(bank);
      default:
        return await toPlaidAccount(bank);
    }
  } catch (error) {
    logError(`An error occurred while loading bank ${bank.$id} (${providerOf(bank)})`, error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public actions used by the pages                                    */
/* ------------------------------------------------------------------ */

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    const banks = await getBanks({ userId });

    const accounts = (await Promise.all(banks.map(loadAccountOnly))).filter(
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
    logError("An error occurred while getting the accounts", error);
  }
};

// Get one bank account. cache() dedupes it within a request: the transactions list
// and the right sidebar both need it.
async function loadAccountNow(appwriteItemId: string) {
  try {
    // Only the signed-in user's own accounts: the id comes from the URL or a cookie.
    const user = await loadLoggedInUser();
    const bank = user ? await findOwnBank(ownerIdOf(user), appwriteItemId) : null;
    if (!bank) return null;

    // Transfers made inside Horizon live in Appwrite regardless of provider.
    const [loaded, transferTransactionsData, corrections] = await Promise.all([
      loadBank(bank),
      getTransactionsByBankId({ bankId: bank.$id }),
      loadCorrections(ownerIdOf(user!)),
    ]);
    if (!loaded) return null;

    const { account, transactions: providerTransactions } = loaded;

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

    // The user's own names and categories, on every screen that shows this account.
    return parseStringify({ data: account, transactions: applyCorrections(allTransactions, corrections) });
  } catch (error) {
    logError("An error occurred while getting the account", error);
  }
}
const loadAccount = cache(loadAccountNow);

export const getAccount = async ({ appwriteItemId }: getAccountProps) => loadAccount(appwriteItemId);

/**
 * Only the newest entries of one of the signed-in user's imported accounts,
 * and the total count, in one quick trip: what a page shows first while the
 * whole account loads behind it. Null for banks connected through Plaid or
 * Setu (their provider sends everything at once) and for someone else's bank.
 */
export async function getRecentEntries(appwriteItemId: string, limit = RECENT_ENTRIES): Promise<{ transactions: Transaction[]; total: number } | null> {
  try {
    const user = await loadLoggedInUser();
    const bank = user ? await findOwnBank(ownerIdOf(user), appwriteItemId) : null;
    if (!bank || providerOf(bank) !== MANUAL_PROVIDER) return null;
    // Imported statements have no Horizon transfers (those need a US bank via Plaid).
    const [recent, corrections] = await Promise.all([getRecentStatementTransactions(bank, limit), loadCorrections(ownerIdOf(user!))]);
    return parseStringify({ transactions: applyCorrections(recent.transactions, corrections), total: recent.total });
  } catch (error) {
    logError("An error occurred while getting the newest entries", error);
    return null;
  }
}

/**
 * The same, without the per-request cache. For server actions that change
 * what an account shows: a cached copy taken before the change would be
 * reused when the page is drawn again after it.
 */
export const getAccountUncached = async ({ appwriteItemId }: getAccountProps) => loadAccountNow(appwriteItemId);

// Get bank info. Only Plaid institutions need a lookup; the others carry their name.
export const getInstitution = async ({ institutionId }: getInstitutionProps) => {
  try {
    if (institutionId.startsWith("manual:")) {
      return parseStringify({ institution_id: institutionId, name: institutionId.slice("manual:".length) });
    }
    if (institutionId.endsWith("-fip") || institutionId.startsWith("setu")) {
      return parseStringify({ institution_id: institutionId, name: setuInstitutionName(institutionId) });
    }
    const institution = await getPlaidInstitution(institutionId);
    return parseStringify(institution);
  } catch (error) {
    logError("An error occurred while getting the institution", error);
  }
};
