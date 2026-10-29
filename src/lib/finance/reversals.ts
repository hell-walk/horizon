import { REVERSED } from "./corrections";

// A payment that failed and came back: the debit and, within a few days, a
// credit of the same amount that either carries the same reference number
// (UPI's RRN sits in both narrations) or says so (reversal, refund, failed).
// Both rows are real statement lines, but neither is spending or income: the
// money never left. Both get the Reversed category, which every total leaves
// out, the way the person's own transfers are. A row the person has already
// labelled is left alone: their word wins.

const WINDOW_DAYS = 3;
const DAY = 86_400_000;
const WORDS = /\brev\b|revers|\brvsl\b|refund|\bret\b|return|fail|declin|unsuccess|chargeback|\brrn\b/i;
const refsOf = (name: string): string[] => name.match(/\d{10,}/g) ?? [];

type Row = Pick<Transaction, "id" | "name" | "amount" | "type" | "date" | "userCategory">;
const isDebit = (t: Row) => t.type === "debit" || (t.type !== "credit" && Number(t.amount) < 0);
const dayOf = (t: Row) => Math.round(Date.parse(`${String(t.date).slice(0, 10)}T00:00:00Z`) / DAY);

/** The ids of every row that belongs to a reversed pair. */
export function findReversals(transactions: readonly Row[]): Set<string> {
  const out = new Set<string>();
  const byAmount = new Map<number, Row[]>();
  for (const t of transactions) {
    if (t.userCategory) continue;
    const amount = Math.round(Math.abs(Number(t.amount) || 0) * 100);
    if (!amount || !Number.isFinite(dayOf(t))) continue;
    byAmount.set(amount, [...(byAmount.get(amount) ?? []), t]);
  }
  for (const rows of byAmount.values()) {
    const debits = rows.filter(isDebit).sort((a, b) => dayOf(a) - dayOf(b));
    const credits = rows.filter((t) => !isDebit(t)).sort((a, b) => dayOf(a) - dayOf(b));
    if (!debits.length || !credits.length) continue;
    const taken = new Set<Row>();
    for (const d of debits) {
      const refs = refsOf(d.name ?? "");
      const back = credits.find((c) => {
        if (taken.has(c) || Math.abs(dayOf(c) - dayOf(d)) > WINDOW_DAYS) return false;
        const shared = refs.length > 0 && refsOf(c.name ?? "").some((r) => refs.includes(r));
        return shared || WORDS.test(c.name ?? "");
      });
      if (!back) continue;
      taken.add(back);
      out.add(d.id).add(back.id);
    }
  }
  return out;
}

/** The rows with every reversed pair labelled Reversed (the person's own labels untouched). */
export function markReversals<T extends Row>(transactions: T[]): (T & Pick<Transaction, "userCategory" | "changedBy">)[] {
  const paired = findReversals(transactions);
  if (paired.size === 0) return transactions;
  return transactions.map((t) => (paired.has(t.id) ? { ...t, userCategory: REVERSED, changedBy: "pair" as const } : t));
}
