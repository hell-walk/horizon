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
//   plan        - an app store (Google Play, Apple) takes the same amount on
//                 a rhythm: which subscription is it? The price suggests the
//                 answer; the person picks or names it.

import { OWN_TRANSFER, payeeKey } from "./corrections";
import { findSalary, type IncomeKind } from "./income";
import { payeeWords } from "./payees";
import { isStore, planGuesses } from "./planNames";
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
    }
  | {
      key: string;
      kind: "plan";
      accountId: string;
      txId: string;
      payeeKey: string;
      payee: string;
      amount: number;
      cadence: Cadence;
      currency: string;
      guesses: string[];
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

  // Money in from the person themselves: their first name in the payee's name, or
  // either name inside the UPI handle ("pandey.aaditya@oksbi", "aadity4"), where SBI
  // and others put the sender's id. A surname alone is a relative, not asked about.
  const first = (input.person.firstName ?? "").trim().toLowerCase();
  const handleNames = [first, (input.person.lastName ?? "").trim().toLowerCase()].filter((n) => n.length >= 4);
  if (first.length >= 3 || handleNames.length) {
    for (const a of accounts) {
      for (const t of a.transactions) {
        if (isDebit(t) || t.userCategory) continue;
        const key = payeeKey(t.name);
        if (!key) continue;
        const byName = first.length >= 3 && key.split(" ").includes(first);
        const handles = String(t.name)
          .toLowerCase()
          .split(/[/|]/)
          .filter((seg) => seg.includes("@") || /^[a-z]+[.\-_]?[a-z]*\d*$/.test(seg.trim()))
          .map((seg) => seg.replace(/[^a-z]/g, ""));
        // Handles get cut short ("aadity4" for Aaditya): the name may contain the handle, or the handle the name.
        const byHandle = handleNames.some((n) => handles.some((h) => h.length >= 5 && (h.includes(n) || n.includes(h))));
        if (!byName && !byHandle) continue;
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

  // A store's subscription that the person has not named yet: which one is it?
  for (const a of accounts) {
    for (const r of a.regular) {
      if (r.direction !== "out" || r.kind !== "subscription" || r.status === "stopped") continue;
      const tx = a.transactions.find((t) => t.id === r.seen[0]?.id);
      if (!tx || tx.shownName || tx.userCategory) continue;
      const key = payeeKey(tx.name);
      if (!key || !isStore(key)) continue;
      add({
        key: `plan:${key}|${Math.round(r.amount)}`,
        kind: "plan",
        accountId: a.id,
        txId: tx.id,
        payeeKey: key,
        payee: payeeWords(tx.name),
        amount: r.amount,
        cadence: r.cadence,
        currency: a.currency,
        guesses: planGuesses(key, r.amount, a.currency),
      });
    }
  }

  return checks.slice(0, limit);
}
