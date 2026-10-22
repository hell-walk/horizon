import "server-only";

import type { IncomeKind } from "../income";

import { cached, remember, TTL } from "../cache";
import { createAdminClient } from "./appwrite";

// A person's settings: the column layouts they chose for their bank's
// statements, their names and categories, their goals, their country. Kept as
// one JSON text on their profile row (`prefs`), so they belong to the profile,
// whatever service handles sign-in. Read defensively: whatever is stored is
// checked by the code that uses it (readCorrections, readGoals...).

export type Prefs = {
  statementLayouts?: unknown;
  corrections?: unknown;
  goals?: unknown;
  country?: string;
  /** Reminder settings: email on or off, the devices for push, what was sent (lib/notify.ts). */
  notify?: unknown;
  /** Missing weeks found while importing: "ask" first (the default) or "add" without asking. */
  importGaps?: "ask" | "add";
  /** How the person earns, and a freelancer's own monthly figure (lib/income). */
  income?: { kind: IncomeKind; declared?: number; salaryPayee?: string; excluded?: string[]; side?: number; payDay?: number };
  /** Home's questions: what was answered (keys), and how many answers were used (free: three). */
  checks?: { answered: string[]; used: number };
  /** What the person told Horizon about each loan, by the loan's key (server/loanPlans). */
  loanPlans?: unknown;
};

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID } = process.env;
const MAX_LENGTH = 100_000; // the field's size in Appwrite

const parse = (value: unknown): Prefs => {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Prefs) : {};
  } catch {
    return {};
  }
};

const key = (ownerId: string) => `prefs:${ownerId}`;

async function readPrefsNow(ownerId: string): Promise<Prefs> {
  const { database } = await createAdminClient();
  const profile = await database.getDocument(DATABASE_ID!, USER_COLLECTION_ID!, ownerId);
  return parse((profile as Record<string, unknown>).prefs);
}

/**
 * The settings on a profile (`ownerId` is the profile row's id): read once per
 * request, however many parts of the page ask. A change through updatePrefs
 * is seen by the page drawn right after it.
 */
export const readPrefs = (ownerId: string): Promise<Prefs> => cached(key(ownerId), TTL.short, () => readPrefsNow(ownerId));

/** Changes some settings and keeps the rest. Refuses (throws) rather than cut stored JSON short. */
export async function updatePrefs(ownerId: string, change: Partial<Prefs>): Promise<Prefs> {
  // Read fresh: a change must build on what is stored now, not on a copy from earlier in the request.
  const next = { ...(await readPrefsNow(ownerId)), ...change };
  const text = JSON.stringify(next);
  if (text.length > MAX_LENGTH) throw new Error("prefs: too large to store");
  const { database } = await createAdminClient();
  await database.updateDocument(DATABASE_ID!, USER_COLLECTION_ID!, ownerId, { prefs: text });
  remember(key(ownerId), next, TTL.short);
  return next;
}
