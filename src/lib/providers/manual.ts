// "Manual" provider: banks the user added by importing a statement export.
// Balances and transactions live in Appwrite (banks table + statement_transactions),
// so nothing about the account ever leaves the app.

import { Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { cached, TTL } from "../cache";

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
  };
}

/** Imported transactions for one manual bank, newest first, cached briefly. */
export const getStatementTransactions = (bank: Bank) =>
  cached(`statement:${bank.$id}`, TTL.short, async () => {
    const { database } = await createAdminClient();
    const result = await database.listDocuments(DATABASE_ID!, STATEMENT_COLLECTION_ID!, [
      Query.equal("bankId", [bank.$id]),
      Query.orderDesc("date"),
      Query.limit(1000),
    ]);

    return result.documents.map((doc) => ({
      id: doc.$id,
      name: doc.name as string,
      paymentChannel: "other",
      type: doc.type as string,
      accountId: bank.accountId,
      amount: doc.amount as number,
      pending: false,
      category: (doc.category as string) || "Transfer",
      date: doc.date as string,
      image: "",
      currency: bank.currency ?? "INR",
    })) as unknown as Transaction[];
  });
