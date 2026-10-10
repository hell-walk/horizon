import "server-only";

import { cached, remember, TTL } from "../cache";
import { readCorrections, type Corrections } from "../corrections";
import { logError } from "./log";
import { readPrefs, updatePrefs } from "./prefs";

// Corrections live in the person's settings on their profile (prefs.ts), next
// to the saved statement layouts; deleting the account deletes them. Writes go
// through the cache, so the page shown right after a change never reads an
// older copy back.

const key = (ownerId: string) => `corrections:${ownerId}`;
const KEEP = 5 * TTL.minute;

export async function loadCorrections(ownerId: string): Promise<Corrections> {
  try {
    const stored = await cached(key(ownerId), KEEP, async () => readCorrections((await readPrefs(ownerId)).corrections));
    return structuredClone(stored); // callers may change their copy
  } catch (error) {
    logError("corrections: could not read", error);
    return readCorrections(undefined);
  }
}

export async function storeCorrections(ownerId: string, corrections: Corrections) {
  await updatePrefs(ownerId, { corrections });
  remember(key(ownerId), structuredClone(corrections), KEEP);
}
