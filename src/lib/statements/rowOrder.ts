// The order a bank listed a day's rows in, recovered from the balance column:
// each row's balance is the previous balance plus or minus its own amount, so
// from the day's opening balance the rows chain in exactly one way (a reversed
// payment brings the balance back to a value it already had, which is why the
// walk backtracks instead of taking the first row that fits). Used to give
// rows saved before `seq` existed their place (scripts/backfill-row-order.mts),
// and by the statement check that proves an import is complete.

export type OrderRow = { id: string; date: string; amount: number; type: string; balance: number | null };
export type DayOrder = {
  ordered: OrderRow[];
  close: number | null;
  /** Every row of the day joined one chain: the order is the bank's. */
  complete: boolean;
  /** The chain starts where the previous day closed; false means a row between the days is missing. */
  connected: boolean;
};

const near = (a: number, b: number) => Math.abs(a - b) <= 0.02;
const move = (r: OrderRow) => (r.type === "credit" ? r.amount : -r.amount);

/** The longest chain of a day's rows from `open`; `complete` when every row joined it. */
export function chainDay(rows: OrderRow[], open: number): DayOrder {
  let best: { used: OrderRow[]; close: number } = { used: [], close: open };
  const walk = (cur: number, used: OrderRow[], left: OrderRow[]) => {
    if (used.length > best.used.length) best = { used: used.slice(), close: cur };
    if (!left.length) return;
    for (let i = 0; i < left.length; i++) {
      const r = left[i];
      if (r.balance == null || !near(cur + move(r), r.balance)) continue;
      used.push(r);
      walk(r.balance, used, left.slice(0, i).concat(left.slice(i + 1)));
      used.pop();
      if (best.used.length === rows.length) return;
    }
  };
  walk(open, [], rows.slice());
  const left = rows.filter((r) => !best.used.includes(r));
  return { ordered: [...best.used, ...left], close: left.length ? null : best.close, complete: left.length === 0, connected: true };
}

/** One day's order: from the previous close when the rows chain from it, else from the start the most rows chain from. */
export function orderDay(rows: OrderRow[], open: number | null): DayOrder {
  if (open != null) {
    const fromOpen = chainDay(rows, open);
    if (fromOpen.complete) return fromOpen;
  }
  let best: DayOrder = { ordered: rows, close: null, complete: false, connected: open == null };
  for (const r of rows) {
    if (r.balance == null) continue;
    const c = chainDay(rows, r.balance - move(r));
    if (c.ordered.length > best.ordered.length - (best.complete ? 0 : rows.length) && c.complete) return { ...c, connected: open == null };
    if (!best.complete && c.close !== null) best = { ...c, connected: open == null };
  }
  return best;
}

/**
 * Every row of one account in the bank's order (oldest first, a day's rows as
 * the bank listed them where the balances say so). `incomplete`: days whose
 * rows could not all be chained, kept in the order they came. `breaks`: days
 * that chain on their own but not from the day before (a row is missing between).
 */
export function orderRows(rows: OrderRow[]): { ordered: OrderRow[]; days: number; incomplete: string[]; breaks: string[] } {
  const byDay = new Map<string, OrderRow[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const dates = [...byDay.keys()].sort();
  const ordered: OrderRow[] = [];
  const incomplete: string[] = [];
  const breaks: string[] = [];
  let close: number | null = null;
  for (const d of dates) {
    const day = orderDay(byDay.get(d)!, close);
    ordered.push(...day.ordered);
    if (!day.complete) incomplete.push(d);
    else if (!day.connected) breaks.push(d);
    close = day.close;
  }
  return { ordered, days: dates.length, incomplete, breaks };
}
