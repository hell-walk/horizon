// Finds entries in a new statement that are already saved for the same
// account. Two kinds:
//   exact  - the same fingerprint (same file, or the same wording): skipped
//            quietly, as before.
//   likely - worded differently but the same money movement, which happens
//            when the same weeks come from two files (a CSV export and a PDF,
//            or two statements that overlap). Same account, same amount, same
//            direction, same day (or one day apart: some exports use the
//            posting date, others the transaction date), and when both rows
//            carry a running balance, the same balance.
// Only saved entries inside the new file's own date range are considered, so
// an entry just outside it is never mistaken for a new one inside it.

export type OverlapRow = { date: string; amount: number; type: string; name: string; balance?: number | null; hash: string };

export type LikelyDuplicate = { index: number; saved: { date: string; name: string } };
export type Overlap = { exact: number[]; likely: LikelyDuplicate[] };

const DAY = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const money = (amount: number) => Math.abs(amount).toFixed(2);
const balancesAgree = (a?: number | null, b?: number | null) => a == null || b == null || Math.abs(a - b) < 0.005;

export function findOverlap(incoming: OverlapRow[], saved: OverlapRow[]): Overlap {
  const savedHashes = new Set(saved.map((row) => row.hash));
  const incomingHashes = new Set(incoming.map((row) => row.hash));

  const exact: number[] = [];
  const open: number[] = [];
  incoming.forEach((row, index) => (savedHashes.has(row.hash) ? exact : open).push(index));
  if (!open.length || !saved.length) return { exact, likely: [] };

  const days = incoming.map((row) => dayNumber(row.date)).filter(Number.isFinite);
  const first = Math.min(...days);
  const last = Math.max(...days);

  // Saved entries this file does not already contain word for word, inside its dates,
  // grouped by amount and direction and then by day.
  const pool = new Map<string, Map<number, OverlapRow[]>>();
  for (const row of saved) {
    if (incomingHashes.has(row.hash)) continue;
    const day = dayNumber(row.date);
    if (!(day >= first && day <= last)) continue;
    const key = `${money(row.amount)}|${row.type}`;
    const byDay = pool.get(key) ?? new Map<number, OverlapRow[]>();
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
    pool.set(key, byDay);
  }

  const likely: LikelyDuplicate[] = [];
  const matched = new Set<number>();
  const take = (index: number, offsets: number[]) => {
    const row = incoming[index];
    const byDay = pool.get(`${money(row.amount)}|${row.type}`);
    if (!byDay) return;
    const day = dayNumber(row.date);
    for (const offset of offsets) {
      const candidates = byDay.get(day + offset);
      const at = candidates?.findIndex((c) => balancesAgree(c.balance, row.balance)) ?? -1;
      if (at < 0) continue;
      const [match] = candidates!.splice(at, 1); // each saved entry pairs with one new entry at most
      likely.push({ index, saved: { date: match.date, name: match.name } });
      matched.add(index);
      return;
    }
  };

  // Same day first for every entry, so a one-day match never takes a saved entry
  // that another new entry matches exactly on its own day.
  for (const index of open) take(index, [0]);
  for (const index of open) if (!matched.has(index)) take(index, [-1, 1]);

  likely.sort((a, b) => a.index - b.index);
  return { exact, likely };
}
