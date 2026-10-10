"use server";

import { revalidatePath } from "next/cache";
import { ID } from "node-appwrite";

import { getT } from "../i18n/server";
import { createAdminClient } from "../server/appwrite";
import { invalidate } from "../cache";
import { MANUAL_PROVIDER } from "../providers/manual";
import {
  buildStatement,
  categorize,
  checkBalances,
  cleanMapping,
  mappingProblem,
  sampleStatement,
  StatementLayoutError,
  StatementParseError,
  StatementPasswordError,
  transactionHashes,
  type BalanceCheck,
  type DateOrder,
  type ParsedStatement,
  type StatementMapping,
  type StatementSample,
} from "../statements/parse";
import { readStatementRowsIsolated } from "../statements/isolated";
import { findOverlap, type Overlap } from "../statements/overlap";
import { applyFixes, findDoubtful, readFixes, type Doubtful } from "../statements/doubtful";
import { findImportedBank, savedStatementRows } from "../server/statementRows";
import { authIdOf, getLoggedInUser, ownerIdOf } from "../server/auth";
import { createBankAccount } from "../server/banks";
import { newSharableId } from "../server/crypto";
import { allow, MINUTE } from "../server/rateLimit";
import { SUPPORTED_CURRENCIES } from "../utils";
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
  | {
      ok: true;
      bankId: string;
      institution: string;
      mask: string;
      imported: number;
      skipped: number;
      /** Entries left out because they looked like ones already saved from another file. */
      likelySkipped: number;
      /** Rows the user chose to skip, or changed, in the "needs a look" list. */
      doubtfulSkipped: number;
      changed: number;
      total: number;
    }
  | ReadFailure;

/**
 * Finds the rows that need a look and applies the user's fixes to them. The
 * balance check is redone on the fixed rows, so a fix that mends the balance
 * shows as mended.
 */
async function withFixes(formData: FormData, parsed: ParsedStatement) {
  const doubtful = findDoubtful(parsed.transactions);
  const flagged = new Set(doubtful.map((d) => d.index));
  const fixes = readFixes(formData.get("fixes"), flagged);
  if (!fixes) return { ok: false as const, error: (await getT())("connect.doubtBadFixes") };
  const applied = applyFixes(parsed.transactions, flagged, fixes, formData.get("skipDoubtful") === "1");
  return {
    ok: true as const,
    doubtful,
    skipped: applied.skipped,
    changed: applied.changed,
    parsed: { ...parsed, transactions: applied.transactions, check: checkBalances(applied.transactions) },
  };
}

/** The bank name and account ending the entries go to: what the user typed, else what the file says. */
/** The date order the user chose on the preview, if any. */
const dateOrderFrom = (formData: FormData): DateOrder | undefined => {
  const value = formData.get("dateOrder");
  return value === "dmy" || value === "mdy" ? value : undefined;
};

/** The currency the user chose on the form, else the one the statement shows. */
const currencyFrom = (formData: FormData, parsed: ParsedStatement) => {
  const value = String(formData.get("currency") || "");
  return SUPPORTED_CURRENCIES.includes(value) ? value : parsed.currency;
};

const accountFrom = (formData: FormData, parsed: ParsedStatement) => ({
  institution: String(formData.get("institution") || "").trim() || parsed.institutionName || "My Bank",
  mask: String(formData.get("mask") || "").replace(/\D/g, "").slice(-4) || parsed.accountMask || "0000",
});

/** How this statement overlaps what is already saved for the same account (nothing, for a new account). */
async function overlapWithSaved(bankId: string | undefined, parsed: ParsedStatement): Promise<{ hashes: string[]; overlap: Overlap }> {
  if (!bankId) return { hashes: [], overlap: { exact: [], likely: [] } };
  const hashes = transactionHashes(bankId, parsed.transactions);
  const incoming = parsed.transactions.map((entry, i) => ({ ...entry, hash: hashes[i] }));
  return { hashes, overlap: findOverlap(incoming, await savedStatementRows(bankId)) };
}

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
      const parsed = buildStatement(rows, file.name, cleanMapping(chosen), { dateOrder: dateOrderFrom(formData) });
      if (!parsed.transactions.length) return needsMapping(t("connect.stNoRowsWithColumns"));
      return { ok: true, parsed, sample: found, source: "manual" };
    }

    const saved = (await savedLayouts(userId))[found.signature];
    if (saved && !mappingProblem(saved, found.width)) {
      const parsed = buildStatement(rows.map((r) => [...r]), file.name, cleanMapping(saved), { dateOrder: dateOrderFrom(formData) });
      if (parsed.transactions.length) return { ok: true, parsed, sample: found, source: "saved" };
    }

    const parsed = buildStatement(rows, file.name, undefined, { dateOrder: dateOrderFrom(formData) });
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
  const { sample, source } = read;
  const fixed = await withFixes(formData, read.parsed);
  if (!fixed.ok) return fixed;
  const { parsed } = fixed;
  if (source === "manual") await rememberLayout(authIdOf(user), sample.signature, parsed.columns);

  const { institution, mask } = accountFrom(formData, parsed);
  // Ticked by the user in the preview: "these are new, save them too".
  const keepLikely = formData.get("keepLikely") === "1";

  try {
    const { database } = await createAdminClient();

    // Reuse the bank if this institution + account was imported before.
    let bankId = await findImportedBank(ownerIdOf(user), institution, mask);
    const { overlap } = await overlapWithSaved(bankId, parsed);
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
        currency: currencyFrom(formData, parsed),
        institutionName: institution,
        accountMask: mask,
        currentBalance: parsed.closingBalance,
      });
      bankId = bank?.$id;
      if (!bankId) return { ok: false, error: t("connect.stBankFailed") };
    }

    const hashes = transactionHashes(bankId, parsed.transactions);
    const leaveOut = new Set([...overlap.exact, ...(keepLikely ? [] : overlap.likely.map((l) => l.index))]);
    const toSave = parsed.transactions.map((entry, i) => ({ entry, hash: hashes[i] })).filter((_, i) => !leaveOut.has(i));

    let imported = 0;
    let skipped = overlap.exact.length;
    for (let i = 0; i < toSave.length; i += INSERT_BATCH) {
      const batch = toSave.slice(i, i + INSERT_BATCH);
      await Promise.all(
        batch.map(async ({ entry, hash }) => {
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
              hash,
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
        currency: currencyFrom(formData, parsed),
      });
    }

    invalidate("banks:");
    invalidate(`statement:${bankId}`);
    revalidatePath("/");

    return {
      ok: true,
      bankId,
      institution,
      mask,
      imported,
      skipped,
      likelySkipped: keepLikely ? 0 : overlap.likely.length,
      doubtfulSkipped: fixed.skipped,
      changed: fixed.changed,
      total: parsed.transactions.length,
    };
  } catch (error) {
    logError("statement: import failed", error);
    return { ok: false, error: t("connect.stSaveFailed") };
  }
};

export type PreviewRow = { date: string; name: string; amount: number; type: string; category: string; balance?: number };
export type LikelyRow = { date: string; name: string; amount: number; type: string; savedDate: string; savedName: string };
export type DoubtfulRow = Doubtful & { date: string; name: string; amount: number; type: "debit" | "credit"; balance?: number };
export type PreviewResult =
  | {
      ok: true;
      institution?: string;
      mask?: string;
      currency: string;
      /** What the statement itself shows, before any choice on the form. */
      detectedCurrency: string;
      dateOrder: { order: DateOrder; sure: boolean; numeric: boolean };
      total: number;
      closingBalance?: number;
      headers: string[];
      rows: PreviewRow[];
      check: BalanceCheck;
      columns: StatementMapping;
      source: LayoutSource;
      sample: StatementSample;
      /** Entries saved before, word for word: skipped. */
      alreadySaved: number;
      /** Entries that look like ones saved from another file; `rows` shows the first few. */
      likely: { count: number; rows: LikelyRow[] };
      /** Rows that need a look, as read from the file (before fixes); `rows` shows the first ones. */
      doubtful: { count: number; rows: DoubtfulRow[] };
      /** What the fixes sent with this preview did. */
      doubtfulSkipped: number;
      changed: number;
    }
  | ReadFailure;

const PREVIEW_ROWS = 6;
const LIKELY_ROWS = 20;
const DOUBTFUL_ROWS = 30;

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
  const { sample, source } = read;
  const fixed = await withFixes(formData, read.parsed);
  if (!fixed.ok) return fixed;
  const { parsed } = fixed;

  let overlap: Overlap = { exact: [], likely: [] };
  try {
    const { institution, mask } = accountFrom(formData, parsed);
    overlap = (await overlapWithSaved(await findImportedBank(ownerIdOf(user), institution, mask), parsed)).overlap;
  } catch (error) {
    // The preview still helps without it; the import checks again.
    logError("statement: overlap check failed", error);
  }

  return {
    ok: true,
    doubtful: {
      count: fixed.doubtful.length,
      rows: fixed.doubtful.slice(0, DOUBTFUL_ROWS).map((d) => {
        const entry = read.parsed.transactions[d.index];
        return { ...d, date: entry.date, name: entry.name, amount: entry.amount, type: entry.type, balance: entry.balance };
      }),
    },
    doubtfulSkipped: fixed.skipped,
    changed: fixed.changed,
    alreadySaved: overlap.exact.length,
    likely: {
      count: overlap.likely.length,
      rows: overlap.likely.slice(0, LIKELY_ROWS).map(({ index, saved }) => {
        const entry = parsed.transactions[index];
        return { date: entry.date, name: entry.name, amount: entry.amount, type: entry.type, savedDate: saved.date, savedName: saved.name };
      }),
    },
    institution: parsed.institutionName,
    mask: parsed.accountMask,
    currency: currencyFrom(formData, parsed),
    detectedCurrency: parsed.currency,
    dateOrder: parsed.dateOrder,
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
