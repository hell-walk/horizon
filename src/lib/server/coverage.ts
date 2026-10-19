import "server-only";

import { cache } from "react";

import { coverageOf, type Coverage, type GapRow } from "../statements/gaps";
import { savedStatementRows } from "./statementRows";

const DAY = 86_400_000;
// Rows saved further apart than this came from different uploads (one upload writes its rows within seconds).
const UPLOAD_GAP_MS = 10 * 60_000;

/** Number the rows by upload: sorted by when they were saved, a new number wherever the saving paused. */
export function byUpload<T extends { createdAt?: string }>(rows: T[]): (T & { batch?: number })[] {
  const dated = rows.filter((r) => r.createdAt && Number.isFinite(Date.parse(r.createdAt))).sort((a, b) => Date.parse(a.createdAt!) - Date.parse(b.createdAt!));
  const batches = new Map<T, number>();
  let batch = 0;
  let last = Number.NEGATIVE_INFINITY;
  for (const r of dated) {
    const at = Date.parse(r.createdAt!);
    if (at - last > UPLOAD_GAP_MS) batch++;
    last = at;
    batches.set(r, batch);
  }
  return rows.map((r) => ({ ...r, batch: batches.get(r) }));
}

/** What one imported account's saved entries cover, the holes in them, and how many days ago the last entry was. Once per request per account. */
export const accountCoverage = cache(async (bankId: string): Promise<(Coverage & { sinceLatest: number }) | null> => {
  const rows: GapRow[] = byUpload(await savedStatementRows(bankId));
  const coverage = coverageOf(rows);
  if (!coverage) return null;
  const sinceLatest = Math.floor(Date.now() / DAY) - Math.floor(Date.parse(`${coverage.to}T00:00:00Z`) / DAY);
  return { ...coverage, sinceLatest };
});
