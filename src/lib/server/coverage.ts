import "server-only";

import { cache } from "react";

import { coverageOf, type Coverage, type GapRow } from "../statements/gaps";
import { getStatementGapRows } from "../providers/manual";

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

export type CoverageStatus = NonNullable<Account["coverageStatus"]>;
/** Entries older than this with nothing after them: the newer statement is probably out. */
export const STALE_DAYS = 14;

/** One word for an account's coverage: a hole, old entries, nothing saved, or fine. */
export const coverageStatusOf = (coverage: (Coverage & { sinceLatest: number }) | null): CoverageStatus =>
  !coverage ? "unknown" : coverage.holes.length > 0 ? "gap" : coverage.sinceLatest > STALE_DAYS ? "stale" : "fresh";

/** The accounts with each uploaded one's coverage status attached, for the cards. */
export async function withCoverage(accounts: Account[]): Promise<Account[]> {
  return Promise.all(
    accounts.map(async (a) =>
      a.provider === "manual" ? { ...a, coverageStatus: coverageStatusOf(await accountCoverage(a.appwriteItemId, a.id, a.currency).catch(() => null)) } : a,
    ),
  );
}

/**
 * What one imported account's saved entries cover, the holes in them, and how
 * many days ago the last entry was. Once per request per account, from the
 * same rows the rest of the page reads (bankId is the bank row's id).
 */
export const accountCoverage = cache(async (bankId: string, accountId: string, currency: string): Promise<(Coverage & { sinceLatest: number }) | null> => {
  const rows: GapRow[] = byUpload(await getStatementGapRows({ $id: bankId, accountId, currency }));
  const coverage = coverageOf(rows);
  if (!coverage) return null;
  const sinceLatest = Math.floor(Date.now() / DAY) - Math.floor(Date.parse(`${coverage.to}T00:00:00Z`) / DAY);
  return { ...coverage, sinceLatest };
});
