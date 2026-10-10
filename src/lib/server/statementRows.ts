import "server-only";

import { Query } from "node-appwrite";

import { MANUAL_PROVIDER } from "../providers/manual";
import type { OverlapRow } from "../statements/overlap";
import { createAdminClient } from "./appwrite";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
  APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID,
} = process.env;

/** The user's imported bank with this name and account ending, if they imported one before. */
export async function findImportedBank(ownerId: string, institution: string, mask: string): Promise<string | undefined> {
  const { database } = await createAdminClient();
  const existing = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
    Query.equal("userId", [ownerId]),
    Query.equal("provider", [MANUAL_PROVIDER]),
    Query.equal("institutionName", [institution]),
    Query.equal("accountMask", [mask]),
  ]);
  return existing.documents[0]?.$id;
}

/** Every saved entry of one imported bank, page by page, in the shape the overlap check needs. */
export async function savedStatementRows(bankId: string): Promise<OverlapRow[]> {
  const { database } = await createAdminClient();
  const out: OverlapRow[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 500; page++) {
    const result = await database.listDocuments(DATABASE_ID!, STATEMENT_COLLECTION_ID!, [
      Query.equal("bankId", [bankId]),
      Query.limit(100),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    for (const doc of result.documents) {
      out.push({
        date: String(doc.date),
        amount: Number(doc.amount),
        type: String(doc.type),
        name: String(doc.name ?? ""),
        balance: typeof doc.balance === "number" ? doc.balance : null,
        hash: String(doc.hash ?? ""),
      });
    }
    if (result.documents.length < 100) break;
    cursor = result.documents[result.documents.length - 1].$id;
  }
  return out;
}
