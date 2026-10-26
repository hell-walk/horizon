import { findCharges } from "./charges";
import { lenderOf } from "./loans";
import { addMonths, type Regular } from "./recurring";
import { daysUntil } from "./regularText";

// "Be prepared": money about to leave, said before it does. EMIs due this week
// (and whether the account looks able to cover them), bank charges that come
// back on a rhythm (SMS alerts every quarter, the debit card's yearly fee), and
// a recent minimum-balance penalty, so it is not paid twice.
//
// Everything is worked out from the statements, which end on some date in the
// past. Dates are estimates; balances are "as of" the statement's last day.

export type HeadsUpAccount = { id: string; name: string; mask: string; currency: string };

export type HeadsUp =
  | { kind: "shortfall"; account: HeadsUpAccount; balance: number; needed: number; asOf: string }
  | { kind: "emi"; account: HeadsUpAccount; lender: string; amount: number; fixed: boolean; date: string; days: number }
  | { kind: "charge"; account: HeadsUpAccount; charge: "sms" | "card"; amount: number; date: string; days: number }
  | { kind: "minBalance"; account: HeadsUpAccount; amount: number; date: string };

export type HeadsUpInput = {
  account: HeadsUpAccount;
  /** The statement's closing balance; null when the statement had no balance column. */
  balance: number | null;
  transactions: Transaction[];
  regular: Regular[];
};

export type HeadsUpResult = {
  items: HeadsUp[];
  /** The newest date any statement reaches, when that is over a month ago: reminders may be missing. */
  staleSince: string | null;
};

const EMI_DAYS = 7;
const CHARGE_DAYS = 30;
const MIN_BALANCE_RECENT_DAYS = 100;
const STALE_DAYS = 35;
/** How often a charge kind comes back, in months. */
const CHARGE_EVERY: Record<"sms" | "card", number> = { sms: 3, card: 12 };

const lastDateOf = (transactions: Transaction[]) =>
  transactions.reduce((last, t) => (/^\d{4}-\d{2}-\d{2}/.test(t.date ?? "") && t.date > last ? t.date : last), "").slice(0, 10);

/** What to be ready for, across a person's accounts: the most pressing first. */
export function headsUp(accounts: HeadsUpInput[], today = new Date()): HeadsUpResult {
  const items: HeadsUp[] = [];
  let newest = "";

  for (const { account, balance, transactions, regular } of accounts) {
    const asOf = lastDateOf(transactions);
    if (!asOf) continue;
    if (asOf > newest) newest = asOf;
    const nameOf = new Map(transactions.map((t) => [t.id, t.name]));

    // EMIs due in the coming week.
    const emis: Extract<HeadsUp, { kind: "emi" }>[] = [];
    for (const r of regular) {
      if (r.kind !== "emi" || r.direction !== "out" || r.status !== "upcoming") continue;
      const days = daysUntil(r.next, today);
      if (days < 0 || days > EMI_DAYS) continue;
      const lender = lenderOf(nameOf.get(r.seen[0]?.id) ?? "")?.name ?? r.name;
      emis.push({ kind: "emi", account, lender, amount: r.amount, fixed: r.fixedAmount, date: r.next, days });
    }
    items.push(...emis);

    // Will the account cover them? Only when the balance is recent enough to mean something.
    const needed = emis.reduce((s, e) => s + e.amount, 0);
    if (balance !== null && needed > 0 && daysUntil(asOf, today) >= -STALE_DAYS && balance < needed) {
      items.push({ kind: "shortfall", account, balance, needed: Math.round(needed * 100) / 100, asOf });
    }

    // Charges that come back on a rhythm, from the last time each was taken.
    const report = findCharges(transactions);
    for (const group of report?.groups ?? []) {
      const last = group.entries[0];
      if (!last) continue;
      if (group.kind === "sms" || group.kind === "card") {
        const date = addMonths(last.date, CHARGE_EVERY[group.kind]);
        const days = daysUntil(date, today);
        if (days >= 0 && days <= CHARGE_DAYS) items.push({ kind: "charge", account, charge: group.kind, amount: last.amount, date, days });
      } else if (group.kind === "minBalance" && daysUntil(last.date, today) >= -MIN_BALANCE_RECENT_DAYS) {
        items.push({ kind: "minBalance", account, amount: last.amount, date: last.date });
      }
    }
  }

  const rank = (h: HeadsUp) => (h.kind === "shortfall" ? 0 : h.kind === "minBalance" ? 2 : 1);
  const when = (h: HeadsUp) => ("days" in h ? h.days : 0);
  items.sort((a, b) => rank(a) - rank(b) || when(a) - when(b));

  return { items, staleSince: newest && daysUntil(newest, today) < -STALE_DAYS ? newest : null };
}
