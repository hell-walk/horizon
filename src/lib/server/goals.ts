import "server-only";

import { cached, remember, TTL } from "../cache";
import { readGoals, type Goal } from "../goals";
import { createAdminClient } from "./appwrite";
import { logError } from "./log";

// Goals live in the account's preferences, like corrections: every user has
// them, they are in the data download, and deleting the account deletes them.
// Writes go through the cache so the page drawn after a change shows it.

const key = (authId: string) => `goals:${authId}`;
const KEEP = 5 * TTL.minute;

export async function loadGoals(authId: string): Promise<Goal[]> {
  try {
    const stored = await cached(key(authId), KEEP, async () => {
      const { user } = await createAdminClient();
      return readGoals((await user.getPrefs(authId)).goals);
    });
    return structuredClone(stored);
  } catch (error) {
    logError("goals: could not read", error);
    return [];
  }
}

export async function storeGoals(authId: string, goals: Goal[]) {
  const { user } = await createAdminClient();
  const prefs = await user.getPrefs(authId);
  await user.updatePrefs(authId, { ...JSON.parse(JSON.stringify(prefs)), goals });
  remember(key(authId), structuredClone(goals), KEEP);
}
