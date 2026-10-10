import "server-only";

import { cached, remember, TTL } from "../cache";
import { readGoals, type Goal } from "../goals";
import { logError } from "./log";
import { readPrefs, updatePrefs } from "./prefs";

// Goals live in the person's settings on their profile (prefs.ts), like
// corrections: they are in the data download, and deleting the account
// deletes them. Writes go through the cache so the page drawn after a change
// shows it.

const key = (ownerId: string) => `goals:${ownerId}`;
const KEEP = 5 * TTL.minute;

export async function loadGoals(ownerId: string): Promise<Goal[]> {
  try {
    const stored = await cached(key(ownerId), KEEP, async () => readGoals((await readPrefs(ownerId)).goals));
    return structuredClone(stored);
  } catch (error) {
    logError("goals: could not read", error);
    return [];
  }
}

export async function storeGoals(ownerId: string, goals: Goal[]) {
  await updatePrefs(ownerId, { goals });
  remember(key(ownerId), structuredClone(goals), KEEP);
}
