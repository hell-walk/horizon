// "Manual" provider: banks the user added by importing a statement export.
// Balances and transactions live in Appwrite (banks table + statement_transactions),
// so nothing about the account ever leaves the app.

import { Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { cached, TTL } from "../cache";
import { categorize } from "../categories";
import { loadExtraTerms } from "../server/terms";

export const MANUAL_PROVIDER = "manual" as const;

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID,
} = process.env;

/** Maps a manual bank row into the app's Account shape. */
export function toManualAccount(bank: Bank): Account {
  const institution = bank.institutionName || "Bank";
  return {
    id: bank.accountId,
    availableBalance: bank.currentBalance ?? 0,
    currentBalance: bank.currentBalance ?? 0,
    institutionId: `manual:${institution}`,
    name: institution,
    officialName: `${institution} account ending ${bank.accountMask ?? "0000"} (imported statement)`,
    mask: bank.accountMask ?? "0000",
    type: "depository",
    subtype: "savings",
    appwriteItemId: bank.$id,
    sharableId: bank.sharableId,
    currency: bank.currency ?? "INR",
    provider: MANUAL_PROVIDER,
    cardDesign: bank.cardDesign,
    balanceUnknown: bank.currentBalance === undefined || bank.currentBalance === null,
  };
}

// Read in pages of this size, up to a ceiling no real account comes near
// (ten years of a busy account is around 20,000 entries).
const PAGE = 1000;
const MAX_ENTRIES = 50_000;

/** Every imported transaction for one manual bank, newest first, cached briefly. */
export const getStatementTransactions = (bank: Bank) =>
  cached(`statement:${bank.$id}`, TTL.short, async () => {
    const { database } = await createAdminClient();
    const documents = [];
    let cursor: string | undefined;
    while (documents.length < MAX_ENTRIES) {
      const result = await database.listDocuments(DATABASE_ID!, STATEMENT_COLLECTION_ID!, [
        Query.equal("bankId", [bank.$id]),
        Query.orderDesc("date"),
        Query.limit(PAGE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ]);
      documents.push(...result.documents);
      if (result.documents.length < PAGE) break;
      cursor = result.documents[result.documents.length - 1].$id;
    }

    // The team's added lender and subscription names, so the re-categorising below sees them.
    await loadExtraTerms();
    return documents.map((doc) => toTransaction(doc, bank));
  });

/** One saved statement row in the app's Transaction shape. */
function toTransaction(doc: Record<string, unknown> & { $id: string }, bank: Bank): Transaction {
  return {
    id: doc.$id,
    name: doc.name as string,
    paymentChannel: "other",
    type: doc.type as string,
    accountId: bank.accountId,
    amount: doc.amount as number,
    pending: false,
    // Worked out again from the bank's wording, so better rules also fix entries imported earlier.
    category: categorize(doc.name as string, doc.type as string),
    date: doc.date as string,
    image: "",
    currency: bank.currency ?? "INR",
  } as unknown as Transaction;
}

/**
 * The newest entries of one manual bank, and how many there are in all, in a
 * single database trip. Measured: up to about 100 entries cost the same one
 * trip (~200-250 ms) as 25; beyond that every 100 more add ~50 ms, and a
 * 1,500-entry account takes about a second whole. So a page shows these first
 * and fetches the rest behind them.
 */
export const RECENT_ENTRIES = 100;
export const getRecentStatementTransactions = (bank: Bank, limit = RECENT_ENTRIES) =>
  cached(`statement:${bank.$id}:recent:${limit}`, TTL.short, async () => {
    const { database } = await createAdminClient();
    const result = await database.listDocuments(DATABASE_ID!, STATEMENT_COLLECTION_ID!, [
      Query.equal("bankId", [bank.$id]),
      Query.orderDesc("date"),
      Query.limit(limit),
    ]);
    return { transactions: result.documents.map((doc) => toTransaction(doc, bank)), total: result.total };
  });
