import "server-only";

import { cached, remember, TTL } from "../cache";
import { readCorrections, type Corrections } from "../corrections";
import { createAdminClient } from "./appwrite";
import { logError } from "./log";

// Corrections live in the account's preferences, next to the saved statement
// layouts: every user has them, and deleting the account deletes them.
// Writes go through the cache, so the page shown right after a change never
// reads an older copy back from Appwrite.

const key = (authId: string) => `corrections:${authId}`;
const KEEP = 5 * TTL.minute;

export async function loadCorrections(authId: string): Promise<Corrections> {
  try {
    const stored = await cached(key(authId), KEEP, async () => {
      const { user } = await createAdminClient();
      return readCorrections((await user.getPrefs(authId)).corrections);
    });
    return structuredClone(stored); // callers may change their copy
  } catch (error) {
    logError("corrections: could not read", error);
    return readCorrections(undefined);
  }
}

export async function storeCorrections(authId: string, corrections: Corrections) {
  const { user } = await createAdminClient();
  const prefs = await user.getPrefs(authId);
  await user.updatePrefs(authId, { ...JSON.parse(JSON.stringify(prefs)), corrections });
  remember(key(authId), structuredClone(corrections), KEEP);
}
