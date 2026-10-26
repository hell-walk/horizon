import "server-only";

import { Query } from "node-appwrite";

import { cached } from "../cache";
import { setExtraTerms } from "../content/extraTerms";
import { parsePlanTerm, setExtraPlans, type PlanRow } from "../finance/recharges";
import type { TermGroup } from "../content/terms";
import { createAdminClient } from "./appwrite";
import { logError } from "./log";

// The lists the team edits in the admin portal (Appwrite "terms" table):
// lenders and pay-later services, subscription services, and recharge plans
// (group "recharge", term "Operator|price|days"). Read every few minutes and
// handed to the sorting rules and the recharge reader, so a name or a plan
// added there reaches everyone without a deploy. Without the table (or if
// Appwrite is slow), the built-in names and plans alone apply, as before.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_TERMS_COLLECTION_ID: TERMS } = process.env;
const EVERY = 5 * 60_000;
const EMPTY: Record<TermGroup, string[]> = { paylater: [], subscription: [] };

type Loaded = { terms: Record<TermGroup, string[]>; plans: PlanRow[] };

async function fetchTerms(): Promise<Loaded> {
  const out: Record<TermGroup, string[]> = { paylater: [], subscription: [] };
  const plans: PlanRow[] = [];
  const { database } = await createAdminClient();
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const result = await database.listDocuments(DATABASE_ID!, TERMS!, [
      Query.equal("active", [true]),
      Query.limit(100),
      Query.select(["$id", "group", "term"]),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    for (const row of result.documents as unknown as { $id: string; group: string; term: string }[]) {
      if (row.group === "paylater" || row.group === "subscription") out[row.group].push(String(row.term));
      else if (row.group === "recharge") {
        const plan = parsePlanTerm(String(row.term));
        if (plan) plans.push(plan);
      }
    }
    if (result.documents.length < 100) break;
    cursor = result.documents[result.documents.length - 1].$id;
  }
  return { terms: out, plans };
}

/**
 * Loads the lists (cached) and hands them to the sorting rules. Call it at the
 * start of anything that sorts entries: the signed-in layout, a statement import.
 */
export async function loadExtraTerms(): Promise<Record<TermGroup, string[]>> {
  if (!DATABASE_ID || !TERMS) return EMPTY;
  try {
    const { terms, plans } = await cached("terms:all", EVERY, fetchTerms);
    setExtraTerms(terms);
    setExtraPlans(plans);
    return terms;
  } catch (error) {
    logError("terms: could not load the portal's lists; built-in names only", error);
    return EMPTY;
  }
}
