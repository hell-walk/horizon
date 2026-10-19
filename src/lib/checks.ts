// "Is this right?": the questions Horizon asks when it is not sure, each one
// worth asking because the answer changes the charts, the income figure or
// what counts as spending. Like a photo app asking "is this you?": a yes or a
// no, stored the same way a manual correction is, so it holds for every later
// statement too. Only asked once; a skip is remembered as well.
//
//   ownPair     - the same amount left one account and arrived in another
//                 within two days: a transfer between the person's own accounts?
//   ownCredit   - money came in from someone carrying the person's own name:
//                 their own money, moved from an account Horizon cannot see?
//   salary      - a company pays much the same each month: the salary?
//   regularKind - a payment comes back on a rhythm but nothing says what it
//                 is: a subscription, an EMI, rent, a bill, or a person?

import { OWN_TRANSFER, payeeKey } from "./corrections";
import { findSalary, type IncomeKind } from "./income";
import { payeeWords } from "./payees";
import type { Cadence, Regular } from "./recurring";
import { spendType } from "./spending";

export type CheckAccount = { id: string; name: string; mask: string; currency: string; transactions: Transaction[]; regular: Regular[] };
export type CheckInput = {
  accounts: CheckAccount[];
  person: { firstName?: string; lastName?: string };
  incomeKind: IncomeKind | null;
  /** The payer the person confirmed as their salary, and the ones they said are not. */
  salaryPrefer?: string;
  salaryExclude?: string[];
  /** Keys already answered (or skipped): never asked again. */
  answered: string[];
};

type Side = { accountId: string; name: string; mask: string; txId: string };
export type Check =
  | { key: string; kind: "ownPair"; amount: number; currency: string; date: string; from: Side; to: Side }
  | { key: string; kind: "ownCredit"; accountId: string; txId: string; payeeKey: string; payee: string; amount: number; currency: string; date: string }
  | { key: string; kind: "salary"; payee: string; monthly: number; months: number; currency: string }
  | {
      key: string;
      kind: "regularKind";
      accountId: string;
      txId: string;
      payeeKey: string;
      payee: string;
      amount: number;
      cadence: Cadence;
      count: number;
      currency: string;
    };

/** What a regular payment of unknown kind can be called. */
export const REGULAR_CHOICES = ["Subscriptions", "EMI & pay later", "Rent", "Bills & recharges", "UPI payments"] as const;

// Buckets that say how a payment went, not what it was for.
const UNKNOWN_PURPOSE = new Set(["UPI payments", "Bank transfer", "Card", "Other"]);
const PAIR_DAYS = 2;
const PAIR_MIN = 100; // small amounts match each other by chance too often
const DAY = 86_400_000;
const isDebit = (t: Transaction) => t.type === "debit" || Number(t.amount) < 0;
const amountOf = (t: Transaction) => Math.abs(Number(t.amount) || 0);
const dayOf = (date: string) => Math.round(Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`) / DAY);

/** The questions worth asking now, the most useful first, at most `limit`. */
export function findChecks(input: CheckInput, limit = 8): Check[] {
  const done = new Set(input.answered);
  const checks: Check[] = [];
  const add = (check: Check) => {
    if (!done.has(check.key) && !checks.some((c) => c.key === check.key)) checks.push(check);
  };
  const { accounts } = input;
  const currency = accounts[0]?.currency ?? "INR";

  // The same amount out of one account and into another, within two days.
  const matched = new Set<string>();
  for (const from of accounts) {
    for (const to of accounts) {
      if (from === to) continue;
      const credits = to.transactions.filter((t) => !isDebit(t) && t.userCategory !== OWN_TRANSFER && amountOf(t) >= PAIR_MIN);
      for (const d of from.transactions) {
        if (!isDebit(d) || d.userCategory === OWN_TRANSFER || amountOf(d) < PAIR_MIN) continue;
        const c = credits.find((x) => !matched.has(x.id) && Math.abs(amountOf(x) - amountOf(d)) < 0.5 && Math.abs(dayOf(x.date) - dayOf(d.date)) <= PAIR_DAYS);
        if (!c) continue;
        matched.add(c.id);
        add({
          key: `own:${d.id}:${c.id}`,
          kind: "ownPair",
          amount: amountOf(d),
          currency: from.currency,
          date: String(d.date).slice(0, 10),
          from: { accountId: from.id, name: from.name, mask: from.mask, txId: d.id },
          to: { accountId: to.id, name: to.name, mask: to.mask, txId: c.id },
        });
      }
    }
  }

  // The salary, once, when the person is salaried and has not confirmed a payer yet.
  if (input.incomeKind === "salaried" && !input.salaryPrefer) {
    const salary = findSalary(
      accounts.flatMap((a) => a.transactions),
      { exclude: input.salaryExclude },
    );
    if (salary)
      add({ key: `salary:${salary.payee.toLowerCase()}`, kind: "salary", payee: salary.payee, monthly: salary.monthly, months: salary.months, currency });
  }

  // Money in from a payee carrying the person's own name: probably their own money.
  const names = [input.person.firstName, input.person.lastName].map((n) => (n ?? "").trim().toLowerCase()).filter((n) => n.length >= 3);
  if (names.length) {
    for (const a of accounts) {
      for (const t of a.transactions) {
        if (isDebit(t) || t.userCategory) continue;
        const key = payeeKey(t.name);
        if (!key || !key.split(" ").some((w) => names.includes(w))) continue;
        add({
          key: `owncredit:${key}`,
          kind: "ownCredit",
          accountId: a.id,
          txId: t.id,
          payeeKey: key,
          payee: t.shownName || payeeWords(t.name),
          amount: amountOf(t),
          currency: a.currency,
          date: String(t.date).slice(0, 10),
        });
      }
    }
  }

  // A payment that comes back on a rhythm, with nothing to say what it is.
  for (const a of accounts) {
    for (const r of a.regular) {
      if (r.direction !== "out" || r.kind !== "other" || r.status === "stopped") continue;
      const tx = a.transactions.find((t) => t.id === r.seen[0]?.id);
      if (!tx || tx.userCategory) continue;
      // Swiggy every month is Food already: only ask when nothing but the rail is known.
      if (!UNKNOWN_PURPOSE.has(spendType(tx))) continue;
      const key = payeeKey(tx.name);
      if (!key) continue;
      add({
        key: `regular:${key}`,
        kind: "regularKind",
        accountId: a.id,
        txId: tx.id,
        payeeKey: key,
        payee: tx.shownName || payeeWords(tx.name),
        amount: r.amount,
        cadence: r.cadence,
        count: r.count,
        currency: a.currency,
      });
    }
  }

  return checks.slice(0, limit);
}
