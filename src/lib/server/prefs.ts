import "server-only";

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

/** The settings on a profile (`ownerId` is the profile row's id). */
export async function readPrefs(ownerId: string): Promise<Prefs> {
  const { database } = await createAdminClient();
  const profile = await database.getDocument(DATABASE_ID!, USER_COLLECTION_ID!, ownerId);
  return parse((profile as Record<string, unknown>).prefs);
}

/** Changes some settings and keeps the rest. Refuses (throws) rather than cut stored JSON short. */
export async function updatePrefs(ownerId: string, change: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs(ownerId)), ...change };
  const text = JSON.stringify(next);
  if (text.length > MAX_LENGTH) throw new Error("prefs: too large to store");
  const { database } = await createAdminClient();
  await database.updateDocument(DATABASE_ID!, USER_COLLECTION_ID!, ownerId, { prefs: text });
  return next;
}
