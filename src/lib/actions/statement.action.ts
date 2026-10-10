"use server";

import { revalidatePath } from "next/cache";
import { ID, Query } from "node-appwrite";

import { createAdminClient } from "../server/appwrite";
import { encryptId } from "../utils";
import { invalidate } from "../cache";
import { MANUAL_PROVIDER } from "../providers/manual";
import {
  buildStatement,
  categorize,
  mappingProblem,
  readStatementRows,
  sampleStatement,
  StatementLayoutError,
  StatementParseError,
  StatementPasswordError,
  transactionHash,
  type BalanceCheck,
  type ParsedStatement,
  type StatementMapping,
  type StatementSample,
} from "../statements/parse";
import { createBankAccount, getLoggedInUser } from "./user.action";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
  APPWRITE_STATEMENT_COLLECTION_ID: STATEMENT_COLLECTION_ID,
} = process.env;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // PDFs with embedded fonts run bigger than CSV exports
const INSERT_BATCH = 10;

/** Why a file could not be read, and what the user can do about it. */
export type ReadFailure = {
  ok: false;
  error: string;
  needsPassword?: boolean;
  needsMapping?: boolean; // the columns could not be worked out; let the user label them
  sample?: StatementSample;
};

export type ImportResult =
  | { ok: true; bankId: string; institution: string; mask: string; imported: number; skipped: number; total: number }
  | ReadFailure;

const MAX_PASSWORD_LENGTH = 64;

// The password only ever lives in this request: it opens the file, then it is gone.
const passwordFrom = (formData: FormData) => {
  const value = formData.get("password");
  return typeof value === "string" && value.length > 0 ? value.slice(0, MAX_PASSWORD_LENGTH) : undefined;
};

export type LayoutSource = "auto" | "saved" | "manual";
type ReadOutcome = { ok: true; parsed: ParsedStatement; sample: StatementSample; source: LayoutSource } | ReadFailure;

const MAX_SAVED_LAYOUTS = 20;

type SavedLayouts = Record<string, StatementMapping>;

// Layouts live in the account's preferences: every user has them, whatever else is set up.
async function savedLayouts(userId: string): Promise<SavedLayouts> {
  try {
    const { user } = await createAdminClient();
    const layouts = (await user.getPrefs(userId)).statementLayouts;
    // A plain copy: the SDK's objects cannot be passed on to the browser.
    return layouts && typeof layouts === "object" ? (JSON.parse(JSON.stringify(layouts)) as SavedLayouts) : {};
  } catch (error) {
    console.error("[statement] could not read saved column layouts", error);
    return {};
  }
}

/** Remembers the user's column mapping for this layout, so the next statement from the same bank just works. */
async function rememberLayout(userId: string, signature: string, mapping: StatementMapping) {
  try {
    const { user } = await createAdminClient();
    const prefs = await user.getPrefs(userId);
    const layouts: SavedLayouts = prefs.statementLayouts && typeof prefs.statementLayouts === "object" ? JSON.parse(JSON.stringify(prefs.statementLayouts)) : {};
    delete layouts[signature]; // re-insert so the newest is kept when trimming
    layouts[signature] = mapping;
    const kept = Object.fromEntries(Object.entries(layouts).slice(-MAX_SAVED_LAYOUTS));
    await user.updatePrefs(userId, { ...prefs, statementLayouts: kept });
  } catch (error) {
    console.error("[statement] could not save the column layout", error);
  }
}

// The signed-in user merges the auth account with the profile row, whose $id wins; prefs belong to the auth account.
const accountIdOf = (user: { $id: string; userId?: string }) => user.userId ?? user.$id;

const mappingFrom = (formData: FormData): unknown => {
  const value = formData.get("mapping");
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Reads the uploaded file with, in order: the columns the user just chose, the
 * layout they chose last time for files shaped like this, or automatic
 * detection. When none of those work, the caller gets sample rows to label.
 */
async function readStatement(formData: FormData, userId: string): Promise<ReadOutcome> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a statement file first." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 10 MB." };

  let sample: StatementSample | undefined;
  try {
    const rows = await readStatementRows({ name: file.name, buffer: Buffer.from(await file.arrayBuffer()), password: passwordFrom(formData) });
    const found = sampleStatement(rows);
    sample = found;
    const needsMapping = (error: string): ReadFailure => ({ ok: false, error, needsMapping: true, sample: found });

    const chosen = mappingFrom(formData);
    if (chosen !== undefined) {
      const problem = mappingProblem(chosen, found.width);
      if (problem) return needsMapping(problem);
      const parsed = buildStatement(rows, file.name, chosen as StatementMapping);
      if (!parsed.transactions.length) return needsMapping("No transactions could be read with those columns. Check the date and amount columns.");
      return { ok: true, parsed, sample: found, source: "manual" };
    }

    const saved = (await savedLayouts(userId))[found.signature];
    if (saved && !mappingProblem(saved, found.width)) {
      const parsed = buildStatement(rows.map((r) => [...r]), file.name, saved);
      if (parsed.transactions.length) return { ok: true, parsed, sample: found, source: "saved" };
    }

    const parsed = buildStatement(rows, file.name);
    if (!parsed.transactions.length) {
      return needsMapping(`No transactions found. Columns detected: ${parsed.headers.filter(Boolean).join(", ") || "none"}. Pick the columns below.`);
    }
    return { ok: true, parsed, sample: found, source: "auto" };
  } catch (error) {
    if (error instanceof StatementPasswordError) return { ok: false, error: error.message, needsPassword: true };
    if (error instanceof StatementLayoutError && sample?.rows.length) {
      return {
        ok: false,
        error: "Horizon could not tell which column is which in this file. Pick them below and it will remember this layout.",
        needsMapping: true,
        sample,
      };
    }
    if (error instanceof StatementParseError) return { ok: false, error: error.message };
    console.error("[statement] read failed", error);
    return { ok: false, error: "The file could not be read. Export it again as CSV or XLSX and retry." };
  }
}

/**
 * Imports a CSV/XLSX statement export for the signed-in user. Creates the bank on
 * first import (matched later by institution + account mask) and stores every
 * transaction that is not already there.
 */
export const importStatement = async (formData: FormData): Promise<ImportResult> => {
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: "You need to be signed in to import a statement." };

  const read = await readStatement(formData, accountIdOf(user));
  if (!read.ok) return read;
  const { parsed, sample, source } = read;
  if (source === "manual") await rememberLayout(accountIdOf(user), sample.signature, parsed.columns);

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

export type PreviewRow = { date: string; name: string; amount: number; type: string; category: string; balance?: number };
export type PreviewResult =
  | {
      ok: true;
      institution?: string;
      mask?: string;
      currency: string;
      total: number;
      closingBalance?: number;
      headers: string[];
      rows: PreviewRow[];
      check: BalanceCheck;
      columns: StatementMapping;
      source: LayoutSource;
      sample: StatementSample;
    }
  | ReadFailure;

const PREVIEW_ROWS = 6;

/**
 * Parses a statement without saving anything, so the user can check that the
 * columns were understood before importing.
 */
export const previewStatement = async (formData: FormData): Promise<PreviewResult> => {
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: "You need to be signed in to import a statement." };

  const read = await readStatement(formData, accountIdOf(user));
  if (!read.ok) return read;
  const { parsed, sample, source } = read;

  return {
    ok: true,
    institution: parsed.institutionName,
    mask: parsed.accountMask,
    currency: parsed.currency,
    total: parsed.transactions.length,
    closingBalance: parsed.closingBalance,
    headers: parsed.headers.filter(Boolean),
    check: parsed.check,
    columns: parsed.columns,
    source,
    sample,
    rows: parsed.transactions.slice(0, PREVIEW_ROWS).map((t) => ({
      date: t.date,
      name: t.name,
      amount: t.amount,
      type: t.type,
      category: categorize(t.name),
      balance: t.balance,
    })),
  };
};
