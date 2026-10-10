"use server";

import { revalidatePath } from "next/cache";
import { ID, Query } from "node-appwrite";

import { getT } from "../i18n/server";
import { createAdminClient } from "../server/appwrite";
import { invalidate } from "../cache";
import { MANUAL_PROVIDER } from "../providers/manual";
import {
  buildStatement,
  categorize,
  cleanMapping,
  mappingProblem,
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
import { readStatementRowsIsolated } from "../statements/isolated";
import { authIdOf, getLoggedInUser, ownerIdOf } from "../server/auth";
import { createBankAccount } from "../server/banks";
import { newSharableId } from "../server/crypto";
import { allow, MINUTE } from "../server/rateLimit";
import { logError } from "../server/log";

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
    logError("statement: could not read saved column layouts", error);
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
    logError("statement: could not save the column layout", error);
  }
}

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
// Statements read at the same time on this server. Each one can use real CPU and
// memory (PDF text extraction, decryption), so a burst waits its turn instead of
// stacking up.
const MAX_PARALLEL_READS = 3;
let readsInProgress = 0;

async function readStatement(formData: FormData, userId: string): Promise<ReadOutcome> {
  const t = await getT();
  // Reading PDFs and unlocking files is heavy work; cap how often one user can ask for it.
  if (!allow(`statement:${userId}`, 30, 10 * MINUTE)) {
    return { ok: false, error: t("connect.stTooMany") };
  }
  if (readsInProgress >= MAX_PARALLEL_READS) {
    return { ok: false, error: t("connect.stBusy") };
  }
  readsInProgress++;
  try {
    return await readStatementNow(formData, userId);
  } finally {
    readsInProgress--;
  }
}

async function readStatementNow(formData: FormData, userId: string): Promise<ReadOutcome> {
  const t = await getT();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: t("connect.stNoFile") };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: t("connect.stTooBig") };

  let sample: StatementSample | undefined;
  try {
    // Read in a disposable, memory-capped worker with no secrets (see statements/isolated.ts).
    const rows = await readStatementRowsIsolated({ name: file.name, buffer: Buffer.from(await file.arrayBuffer()), password: passwordFrom(formData) });
    const found = sampleStatement(rows);
    sample = found;
    const needsMapping = (error: string): ReadFailure => ({ ok: false, error, needsMapping: true, sample: found });

    const chosen = mappingFrom(formData);
    if (chosen !== undefined) {
      const problem = mappingProblem(chosen, found.width);
      if (problem) return needsMapping(problem);
      const parsed = buildStatement(rows, file.name, cleanMapping(chosen));
      if (!parsed.transactions.length) return needsMapping(t("connect.stNoRowsWithColumns"));
      return { ok: true, parsed, sample: found, source: "manual" };
    }

    const saved = (await savedLayouts(userId))[found.signature];
    if (saved && !mappingProblem(saved, found.width)) {
      const parsed = buildStatement(rows.map((r) => [...r]), file.name, cleanMapping(saved));
      if (parsed.transactions.length) return { ok: true, parsed, sample: found, source: "saved" };
    }

    const parsed = buildStatement(rows, file.name);
    if (!parsed.transactions.length) {
      return needsMapping(t("connect.stNoRowsFound", { columns: parsed.headers.filter(Boolean).join(", ") || t("connect.stNone") }));
    }
    return { ok: true, parsed, sample: found, source: "auto" };
  } catch (error) {
    if (error instanceof StatementPasswordError) return { ok: false, error: error.message, needsPassword: true };
    if (error instanceof StatementLayoutError && sample?.rows.length) {
      return {
        ok: false,
        error: t("connect.stLayoutUnknown"),
        needsMapping: true,
        sample,
      };
    }
    if (error instanceof StatementParseError) return { ok: false, error: error.message };
    logError("statement: read failed", error);
    return { ok: false, error: t("connect.stUnreadable") };
  }
}

/**
 * Imports a CSV/XLSX statement export for the signed-in user. Creates the bank on
 * first import (matched later by institution + account mask) and stores every
 * transaction that is not already there.
 */
export const importStatement = async (formData: FormData): Promise<ImportResult> => {
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("connect.stSignIn") };

  const read = await readStatement(formData, authIdOf(user));
  if (!read.ok) return read;
  const { parsed, sample, source } = read;
  if (source === "manual") await rememberLayout(authIdOf(user), sample.signature, parsed.columns);

  const institution = String(formData.get("institution") || "").trim() || parsed.institutionName || "My Bank";
  const mask = String(formData.get("mask") || "").replace(/\D/g, "").slice(-4) || parsed.accountMask || "0000";

  try {
    const { database } = await createAdminClient();

    // Reuse the bank if this institution + account was imported before.
    const existing = await database.listDocuments(DATABASE_ID!, BANK_COLLECTION_ID!, [
      Query.equal("userId", [ownerIdOf(user)]),
      Query.equal("provider", [MANUAL_PROVIDER]),
      Query.equal("institutionName", [institution]),
      Query.equal("accountMask", [mask]),
    ]);

    let bankId = existing.documents[0]?.$id as string | undefined;
    if (!bankId) {
      const accountId = `manual-${ID.unique()}`;
      const bank = await createBankAccount({
        userId: ownerIdOf(user),
        bankId: accountId,
        accountId,
        accessToken: "manual",
        fundingSourceUrl: "",
        sharableId: newSharableId(),
        provider: MANUAL_PROVIDER,
        currency: parsed.currency,
        institutionName: institution,
        accountMask: mask,
        currentBalance: parsed.closingBalance,
      });
      bankId = bank?.$id;
      if (!bankId) return { ok: false, error: t("connect.stBankFailed") };
    }

    let imported = 0;
    let skipped = 0;
    for (let i = 0; i < parsed.transactions.length; i += INSERT_BATCH) {
      const batch = parsed.transactions.slice(i, i + INSERT_BATCH);
      await Promise.all(
        batch.map(async (entry) => {
          try {
            await database.createDocument(DATABASE_ID!, STATEMENT_COLLECTION_ID!, ID.unique(), {
              bankId,
              userId: ownerIdOf(user),
              date: entry.date,
              name: entry.name.slice(0, 255),
              amount: entry.amount,
              type: entry.type,
              category: categorize(entry.name),
              balance: entry.balance ?? null,
              reference: entry.reference?.slice(0, 255) ?? null,
              hash: transactionHash(bankId!, entry),
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
    logError("statement: import failed", error);
    return { ok: false, error: t("connect.stSaveFailed") };
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
  const t = await getT();
  const user = await getLoggedInUser();
  if (!user) return { ok: false, error: t("connect.stSignIn") };

  const read = await readStatement(formData, authIdOf(user));
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
    rows: parsed.transactions.slice(0, PREVIEW_ROWS).map((entry) => ({
      date: entry.date,
      name: entry.name,
      amount: entry.amount,
      type: entry.type,
      category: categorize(entry.name),
      balance: entry.balance,
    })),
  };
};
