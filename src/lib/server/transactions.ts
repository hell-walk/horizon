import "server-only";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../server/appwrite";
import { parseStringify } from "../utils";
import { cached, invalidate, TTL } from "../cache";
import { logError } from "./log";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

/** Saves a transfer record; null when it could not be saved (the caller must say so). */
export const createTransaction = async (transaction: CreateTransactionProps) => {
  try {
    const { database } = await createAdminClient();

    const newTransaction = await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      {
        channel: 'online',
        category: 'Transfer',
        ...transaction
      }
    )

    invalidate("transfers:");

    return parseStringify(newTransaction);
  } catch (error) {
    logError("transactions: could not save a transfer record", error);
    return null;
  }
}

export const getTransactionsByBankId = async ({bankId}: getTransactionsByBankIdProps) => {
  try {
    const { database } = await createAdminClient();

    // The two queries are independent, so they run together and are cached briefly.
    const [senderTransactions, receiverTransactions] = await cached(
      `transfers:${bankId}`,
      TTL.short,
      () =>
        Promise.all([
          database.listDocuments(DATABASE_ID!, TRANSACTION_COLLECTION_ID!, [Query.equal('senderBankId', bankId)]),
          database.listDocuments(DATABASE_ID!, TRANSACTION_COLLECTION_ID!, [Query.equal('receiverBankId', bankId)]),
        ])
    );

    const transactions = {
      total: senderTransactions.total + receiverTransactions.total,
      documents: [
        ...senderTransactions.documents, 
        ...receiverTransactions.documents,
      ]
    }

    return parseStringify(transactions);
  } catch (error) {
    logError("transactions", error);
  }
}