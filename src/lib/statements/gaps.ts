// Missing weeks between a new statement and what is already saved for the same
// account. Statements are uploaded by hand, so someone can skip a month: the
// entries still add up on their own, but balances, charts, bills and forecasts
// built across the hole are wrong. Found two ways:
//   dates   - the new file starts (or ends) well away from the saved entries,
//             with nothing in between;
//   balance - both sides carry a running balance and they do not join up: the
//             new file's opening balance is not where the saved entries ended
//             (or the other way round), so entries are missing even if the
//             dates nearly touch.

export type GapRow = { date: string; amount: number; type: string; balance?: number | null };
export type Gap = { from: string; to: string; days: number; reason: "dates" | "balance" };

/** Days of silence between statements that count as missing entries. A quiet week is normal; a month is not. */
export const GAP_DAYS = 10;
const DAY = 86_400_000;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const signed = (row: GapRow) => (row.type === "credit" ? 1 : -1) * Math.abs(row.amount);
const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** The rows on a statement's first or last day, when there is exactly one (several on one day: their order is unknown). */
function only(rows: GapRow[], day: number): GapRow | null {
  const onDay = rows.filter((r) => dayOf(r.date) === day);
  return onDay.length === 1 && typeof onDay[0].balance === "number" ? onDay[0] : null;
}

/** The hole between saved entries and a new statement, or null when they meet or overlap. */
export function importGap(saved: GapRow[], incoming: GapRow[]): Gap | null {
  const s = saved.filter((r) => Number.isFinite(dayOf(r.date)));
  const n = incoming.filter((r) => Number.isFinite(dayOf(r.date)));
  if (!s.length || !n.length) return null;
  const sFirst = Math.min(...s.map((r) => dayOf(r.date)));
  const sLast = Math.max(...s.map((r) => dayOf(r.date)));
  const nFirst = Math.min(...n.map((r) => dayOf(r.date)));
  const nLast = Math.max(...n.map((r) => dayOf(r.date)));
  const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

  // Which side comes first; overlapping ranges have no hole between them.
  let earlier: { rows: GapRow[]; last: number };
  let later: { rows: GapRow[]; first: number };
  if (nFirst > sLast) {
    earlier = { rows: s, last: sLast };
    later = { rows: n, first: nFirst };
  } else if (sFirst > nLast) {
    earlier = { rows: n, last: nLast };
    later = { rows: s, first: sFirst };
  } else {
    return null;
  }

  const days = later.first - earlier.last;
  if (days > GAP_DAYS) return { from: iso(earlier.last), to: iso(later.first), days, reason: "dates" };

  // Close in dates: do the balances join? The later side opened at its first balance minus its first entry.
  const end = only(earlier.rows, earlier.last);
  const start = only(later.rows, later.first);
  if (end && start && !near(end.balance!, start.balance! - signed(start))) {
    return { from: iso(earlier.last), to: iso(later.first), days, reason: "balance" };
  }
  return null;
}

/** Whether a new statement reaches at least as far as the saved entries (so its closing balance is the latest). */
export function reachesLatest(saved: GapRow[], incoming: GapRow[]): boolean {
  if (!saved.length) return true;
  const latest = (rows: GapRow[]) => rows.reduce((last, r) => (r.date > last ? r.date : last), "").slice(0, 10);
  return latest(incoming) >= latest(saved);
}
