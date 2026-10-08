"use server";

import { revalidatePath } from "next/cache";
import { ID, Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { encryptId } from "../utils";
import { invalidate } from "../cache";
import { MANUAL_PROVIDER } from "../providers/manual";
import { categorize, parseStatement, StatementParseError, transactionHash } from "../statements/parse";
import { createBankAccount, getLoggedInUser } from "./user.action";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
  APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID,
} = process.env;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INSERT_BATCH = 10;

export type ImportResult =
  | { ok: true; bankId: string; institution: string; mask: string; imported: number; skipped: number; total: number }
  | { ok: false; error: string };

/**
 * Imports a CSV/XLSX statement export for the signed-in user. Creates the bank on
 * first import (matched later by institution + account mask) and stores every
 * transaction that is not already there.
 */
export const importStatement = async (formData: FormData): Promise<ImportResult> => {
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: "You need to be signed in to import a statement." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a statement file first." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 5 MB." };

  let parsed;
  try {
    parsed = await parseStatement({ name: file.name, buffer: Buffer.from(await file.arrayBuffer()) });
  } catch (error) {
    if (error instanceof StatementParseError) return { ok: false, error: error.message };
    console.error("[statement] parse failed", error);
    return { ok: false, error: "The file could not be read. Export it again as CSV or XLSX and retry." };
  }

  if (parsed.transactions.length === 0) {
    return {
      ok: false,
      error: `No transactions found. Columns detected: ${parsed.headers.filter(Boolean).join(", ") || "none"}.`,
    };
  }

  const institution = String(formData.get("institution") || "").trim() || parsed.institutionName || "My Bank";
  const mask = String(formData.get("mask") || "").replace(/\D/g, "").slice(-4) || parsed.accountMask || "0000";

  try {
    const { database } = await createAdminClient();

    // Reuse the bank if this institution + account was imported before.
    const existing = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
      Query.equal("userId", [user.$id]),
      Query.equal("provider", [MANUAL_PROVIDER]),
      Query.equal("institutionName", [institution]),
      Query.equal("accountMask", [mask]),
    ]);

    let bankId = existing.documents[0]?.$id as string | undefined;
    if (!bankId) {
      const accountId = `manual-${ID.unique()}`;
      const bank = await createBankAccount({
        userId: user.$id,
        bankId: accountId,
        accountId,
        accessToken: "manual",
        fundingSourceUrl: "",
        sharableId: encryptId(accountId),
        provider: MANUAL_PROVIDER,
        currency: parsed.currency,
        institutionName: institution,
        accountMask: mask,
        currentBalance: parsed.closingBalance,
      });
      bankId = bank?.$id;
      if (!bankId) return { ok: false, error: "Could not create the bank record." };
    }

    let imported = 0;
    let skipped = 0;
    for (let i = 0; i < parsed.transactions.length; i += INSERT_BATCH) {
      const batch = parsed.transactions.slice(i, i + INSERT_BATCH);
      await Promise.all(
        batch.map(async (t) => {
          try {
            await database.createDocument(DATABASE_ID!, STATEMENT_COLLECTION_ID!, ID.unique(), {
              bankId,
              userId: user.$id,
              date: t.date,
              name: t.name.slice(0, 255),
              amount: t.amount,
              type: t.type,
              category: categorize(t.name),
              balance: t.balance ?? null,
              reference: t.reference?.slice(0, 255) ?? null,
              hash: transactionHash(bankId!, t),
            });
            imported++;
          } catch (error) {
            // The unique index on hash rejects rows imported earlier; anything else is a real failure.
            const code = (error as { code?: number }).code;
            if (code === 409) skipped++;
            else throw error;
          }
        })
      );
    }

    // The statement's last running balance is the best balance we have.
    if (parsed.closingBalance !== undefined) {
      await database.updateDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bankId, {
        currentBalance: parsed.closingBalance,
        currency: parsed.currency,
      });
    }

    invalidate("banks:");
    invalidate(`statement:${bankId}`);
    revalidatePath("/");

    return { ok: true, bankId, institution, mask, imported, skipped, total: parsed.transactions.length };
  } catch (error) {
    console.error("[statement] import failed", error);
    return { ok: false, error: "Saving the statement failed. Check the server log for details." };
  }
};
