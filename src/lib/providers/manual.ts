// "Manual" provider: banks the user added by importing a statement export.
// Balances and transactions live in Appwrite (banks table + statement_transactions),
// so nothing about the account ever leaves the app.

import { Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { cached, TTL } from "../cache";
import { categorize } from "../categories";

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

    return documents.map((doc) => ({
      id: doc.$id,
      name: doc.name as string,
      paymentChannel: "other",
      type: doc.type as string,
      accountId: bank.accountId,
      amount: doc.amount as number,
      pending: false,
      // Worked out again from the bank's wording, so better rules also fix entries imported earlier.
      category: categorize(doc.name as string),
      date: doc.date as string,
      image: "",
      currency: bank.currency ?? "INR",
    })) as unknown as Transaction[];
  });
