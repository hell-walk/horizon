import "server-only";

import { Query } from "node-appwrite";

import { cached } from "../cache";
import { setExtraTerms } from "../extraTerms";
import type { TermGroup } from "../terms";
import { createAdminClient } from "./appwrite";
import { logError } from "./log";

// The lists the team edits in the admin portal (Appwrite "terms" table):
// lenders and pay-later services, and subscription services. Read every few
// minutes and handed to the sorting rules, so a name added there sorts
// everyone's entries without a deploy. Without the table (or if Appwrite is
// slow), the built-in names alone apply, as before.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_TERMS_COLLECTION_ID: TERMS } = process.env;
const EVERY = 5 * 60_000;
const EMPTY: Record<TermGroup, string[]> = { paylater: [], subscription: [] };

async function fetchTerms(): Promise<Record<TermGroup, string[]>> {
  const out: Record<TermGroup, string[]> = { paylater: [], subscription: [] };
  const { database } = await createAdminClient();
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const result = await database.listDocuments(DATABASE_ID!, TERMS!, [Query.equal("active", [true]), Query.limit(100), Query.select(["$id", "group", "term"]), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    for (const row of result.documents as unknown as { $id: string; group: string; term: string }[]) {
      if (row.group === "paylater" || row.group === "subscription") out[row.group].push(String(row.term));
    }
    if (result.documents.length < 100) break;
    cursor = result.documents[result.documents.length - 1].$id;
  }
  return out;
}

/**
 * Loads the lists (cached) and hands them to the sorting rules. Call it at the
 * start of anything that sorts entries: the signed-in layout, a statement import.
 */
export async function loadExtraTerms(): Promise<Record<TermGroup, string[]>> {
  if (!DATABASE_ID || !TERMS) return EMPTY;
  try {
    const terms = await cached("terms:all", EVERY, fetchTerms);
    setExtraTerms(terms);
    return terms;
  } catch (error) {
    logError("terms: could not load the portal's lists; built-in names only", error);
    return EMPTY;
  }
}
