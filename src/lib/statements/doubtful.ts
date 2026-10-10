import type { ParsedTransaction } from "./parse";

// Rows of a statement that deserve a second look before they are saved, and
// the user's fixes for them. Rows are found on the file as read (so their
// positions stay the same however often it is read), fixes are applied after.
//
//   balance  - the running balance does not follow from the row before. Either
//              this row was misread (amount or direction) or a row is missing.
//   future   - a date after today: usually day and month read the wrong way round.
//   farDate  - more than a year away from the middle of the statement.
//   bigAmount- far bigger than everything else in the file (an account or
//              reference number read as the amount).
//   noName   - no description at all.

export type DoubtReason = "balance" | "future" | "farDate" | "bigAmount" | "noName";

export type Doubtful = {
  index: number;
  reasons: DoubtReason[];
  /** For a balance break: what would make it add up, when one change does. */
  suggestion?: { type?: "debit" | "credit"; amount?: number; date?: string };
  /** For a balance break: the balance the row before plus this row gives, against the one printed. */
  expected?: number;
  actual?: number;
};

export type RowFix = { skip?: boolean; date?: string; amount?: number; type?: "debit" | "credit" };
export type Fixes = Record<number, RowFix>;

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const signed = (t: ParsedTransaction) => (t.type === "credit" ? t.amount : -t.amount);
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function findDoubtful(transactions: ParsedTransaction[], today = new Date()): Doubtful[] {
  const found = new Map<number, Doubtful>();
  const flag = (index: number, reason: DoubtReason, extra: Partial<Doubtful> = {}) => {
    const d = found.get(index) ?? { index, reasons: [] };
    if (!d.reasons.includes(reason)) d.reasons.push(reason);
    found.set(index, { ...d, ...extra, suggestion: d.suggestion || extra.suggestion ? { ...d.suggestion, ...extra.suggestion } : undefined });
  };

  // Balance breaks, with the one change that would mend the row if there is one.
  for (let i = 1; i < transactions.length; i++) {
    const before = transactions[i - 1];
    const now = transactions[i];
    if (before.balance === undefined || now.balance === undefined) continue;
    const expected = round2(before.balance + signed(now));
    if (Math.abs(expected - now.balance) <= 0.01) continue;

    const moved = round2(now.balance - before.balance);
    let suggestion: Doubtful["suggestion"];
    if (Math.abs(Math.abs(moved) - now.amount) <= 0.01)
      suggestion = { type: moved > 0 ? "credit" : "debit" }; // direction read the wrong way
    else if (moved !== 0 && Math.sign(moved) === Math.sign(signed(now))) suggestion = { amount: Math.abs(moved) }; // amount misread
    flag(i, "balance", { suggestion, expected, actual: now.balance });
  }

  // Dates: after today (a day of slack for time zones), or far from the middle of the file.
  const tomorrow = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + DAY;
  const times = transactions.map((t) => time(t.date)).filter(Number.isFinite);
  const middle = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
  transactions.forEach((t, i) => {
    const at = time(t.date);
    if (!Number.isFinite(at)) return;
    if (at > tomorrow) {
      // Most often day and month were read the wrong way round: offer them swapped when that is a real, past date.
      const [y, m, d] = t.date.split("-");
      const swapped = `${y}-${d}-${m}`;
      const ok =
        Number(d) <= 12 && Number.isFinite(time(swapped)) && new Date(time(swapped)).toISOString().slice(0, 10) === swapped && time(swapped) <= tomorrow;
      flag(i, "future", ok ? { suggestion: { date: swapped } } : {});
    } else if (middle !== undefined && Math.abs(at - middle) > 366 * DAY) flag(i, "farDate");
  });

  // Amounts far above the rest of the file.
  const amounts = transactions.map((t) => t.amount).sort((a, b) => a - b);
  const typical = amounts[Math.floor(amounts.length / 2)] ?? 0;
  if (transactions.length >= 5 && typical > 0) {
    transactions.forEach((t, i) => {
      if (t.amount >= 100_000 && t.amount > typical * 100) flag(i, "bigAmount");
    });
  }

  transactions.forEach((t, i) => {
    if (!/\p{L}/u.test(t.name ?? "")) flag(i, "noName");
  });

  return [...found.values()].sort((a, b) => a.index - b.index);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FIXES = 500;

/**
 * Reads the fixes the browser sent. Only rows that were flagged can be fixed;
 * anything malformed makes the whole set invalid (null), so a half-applied
 * set never saves something the user did not mean.
 */
export function readFixes(value: unknown, flagged: Set<number>): Fixes | null {
  if (value === undefined || value === null || value === "") return {};
  let raw: unknown = value;
  if (typeof value === "string") {
    if (value.length > 100_000) return null;
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_FIXES) return null;

  const fixes: Fixes = {};
  for (const [key, fix] of entries) {
    const index = Number(key);
    if (!Number.isInteger(index) || !flagged.has(index) || !fix || typeof fix !== "object") return null;
    const { skip, date, amount, type } = fix as Record<string, unknown>;
    const out: RowFix = {};
    if (skip !== undefined) {
      if (typeof skip !== "boolean") return null;
      out.skip = skip;
    }
    if (date !== undefined) {
      if (typeof date !== "string" || !DATE.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return null;
      out.date = date;
    }
    if (amount !== undefined) {
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount >= 1e12) return null;
      out.amount = round2(amount);
    }
    if (type !== undefined) {
      if (type !== "debit" && type !== "credit") return null;
      out.type = type;
    }
    fixes[index] = out;
  }
  return fixes;
}

/**
 * The statement with the user's fixes applied: skipped rows removed, changed
 * rows changed. With `skipRest`, flagged rows the user did not touch are
 * skipped too ("skip every row that needs a look").
 */
export function applyFixes(transactions: ParsedTransaction[], flagged: Set<number>, fixes: Fixes, skipRest = false) {
  let skipped = 0;
  let changed = 0;
  const out: ParsedTransaction[] = [];
  transactions.forEach((t, i) => {
    const fix = fixes[i];
    const touched = fix && (fix.date !== undefined || fix.amount !== undefined || fix.type !== undefined);
    if (fix?.skip || (skipRest && flagged.has(i) && !touched && fix?.skip !== false)) {
      skipped++;
      return;
    }
    if (touched) {
      changed++;
      out.push({ ...t, ...(fix.date ? { date: fix.date } : {}), ...(fix.amount ? { amount: fix.amount } : {}), ...(fix.type ? { type: fix.type } : {}) });
    } else {
      out.push(t);
    }
  });
  return { transactions: out, skipped, changed };
}
