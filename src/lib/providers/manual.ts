// "Manual" provider: banks the user added by importing a statement export.
// Balances and transactions live in Appwrite (banks table + statement_transactions),
// so nothing about the account ever leaves the app.

import { Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { timed } from "../server/timing";
import { cached, TTL } from "../cache";
import { categorize } from "../finance/categories";
import { loadExtraTerms } from "../server/terms";
import type { GapRow } from "../statements/gaps";

export const MANUAL_PROVIDER = "manual" as const;

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID } = process.env;

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

// Rows kept in this server copy's memory across requests, each with the stamp
// it was read under: ten minutes at most, a few dozen banks at most.
const MEMORY_MS = 10 * 60_000;
// Younger than this, the copy is served without the stamp check (one trip saved on most pages).
const FRESH_MS = process.env.NODE_ENV === "test" ? 0 : 30_000;
const MEMORY_MAX = 40;
type StatementRows = { transactions: Transaction[]; gapRows: (GapRow & { createdAt?: string })[] };
const memory = new Map<string, { stamp: string; rows: StatementRows; at: number }>();

/** After an upload or a deletion: the next read must ask the database again. */
export const forgetRows = (bankId: string) => memory.delete(bankId);

/**
 * Every saved entry of one imported bank: once per request, and across
 * requests for as long as nothing was added or removed. One small trip asks
 * how many entries there are and which was saved last; the same answer as
 * last time means the same rows, so the pages are not read again. Entries
 * are only ever added (an upload) or removed (an account deleted), never
 * edited: the person's own names and categories are applied on top, elsewhere.
 * (Appwrite stops counting at 5,000; the newest entry's id still changes
 * with every upload, so an addition is never missed.)
 */
const loadStatementRows = (bank: Pick<Bank, "$id" | "accountId" | "currency">) =>
  cached(`statement:${bank.$id}`, TTL.short, async (): Promise<StatementRows> => {
    const { database } = await createAdminClient();
    const young = memory.get(bank.$id);
    if (young && Date.now() - young.at < FRESH_MS) return young.rows;
    const latest = await timed("statement stamp", () =>
      database.listDocuments(DATABASE_ID!, STATEMENT_COLLECTION_ID!, [
        Query.equal("bankId", [bank.$id]),
        Query.orderDesc("$createdAt"),
        Query.limit(1),
        Query.select(["$id", "$createdAt"]),
      ]),
    );
    const stamp = `${latest.total}:${latest.documents[0]?.$id ?? ""}`;
    const kept = memory.get(bank.$id);
    if (kept && kept.stamp === stamp && Date.now() - kept.at < MEMORY_MS) return kept.rows;

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
    const rows: StatementRows = {
      transactions: documents.map((doc) => toTransaction(doc, bank)),
      gapRows: documents.map((doc) => ({
        date: String(doc.date),
        amount: Number(doc.amount),
        type: String(doc.type),
        balance: typeof doc.balance === "number" ? doc.balance : null,
        createdAt: typeof doc.$createdAt === "string" ? doc.$createdAt : undefined,
      })),
    };
    memory.delete(bank.$id);
    memory.set(bank.$id, { stamp, rows, at: Date.now() });
    while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
    return rows;
  });

/** Every imported transaction for one manual bank, newest first. Shared: never change the rows in place. */
export const getStatementTransactions = async (bank: Bank): Promise<Transaction[]> => (await loadStatementRows(bank)).transactions;

/** The same entries in the shape the coverage check reads (date, amount, balance, when saved). */
export const getStatementGapRows = async (bank: Pick<Bank, "$id" | "accountId" | "currency">) => (await loadStatementRows(bank)).gapRows;

/** One saved statement row in the app's Transaction shape. */
function toTransaction(doc: Record<string, unknown> & { $id: string }, bank: Pick<Bank, "accountId" | "currency">): Transaction {
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
