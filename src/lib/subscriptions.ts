// Subscriptions: the regular payments the regular-payments finder marked as
// subscriptions (streaming, apps, memberships), what they add up to a month
// and a year, which have stopped, and what each has cost so far. Pure: the
// server passes the regular payments of each account in.

import type { Regular } from "./recurring";

export type Subscription = {
  key: string;
  name: string;
  currency: string;
  /** The usual amount of one payment. */
  amount: number;
  cadence: Regular["cadence"];
  /** About how much a month, whatever the cadence. */
  perMonth: number;
  status: "active" | "stopped";
  /** First and last payments seen (YYYY-MM-DD). */
  since: string;
  last: string;
  /** When the next one is expected (active ones). */
  next?: string;
  count: number;
  /** Everything paid to it in the statements. */
  paid: number;
};

export type SubscriptionPicture = {
  active: Subscription[];
  stopped: Subscription[];
  /** What the running ones cost a month, and a year at that rate. */
  monthly: number;
  yearly: number;
  /** Everything paid to subscriptions, running or stopped, in the statements. */
  paid: number;
  currency: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Every subscription across the accounts, running ones first and costliest first. */
export function subscriptionPicture(accounts: { currency: string; regular: Regular[] }[]): SubscriptionPicture {
  const all: Subscription[] = [];
  for (const { currency, regular } of accounts) {
    for (const r of regular) {
      if (r.kind !== "subscription" || r.direction !== "out") continue;
      const dates = r.seen.map((s) => s.date).sort();
      const stopped = r.status === "stopped";
      all.push({
        key: `${currency}:${r.key}`,
        name: r.name,
        currency,
        amount: r.amount,
        cadence: r.cadence,
        perMonth: r.perMonth,
        status: stopped ? "stopped" : "active",
        since: dates[0] ?? r.last.date,
        last: r.last.date,
        next: stopped ? undefined : r.next,
        count: r.count,
        paid: round2(r.seen.reduce((sum, s) => sum + Math.abs(s.amount), 0)),
      });
    }
  }
  const byCost = (a: Subscription, b: Subscription) => b.perMonth - a.perMonth || a.name.localeCompare(b.name);
  const active = all.filter((s) => s.status === "active").sort(byCost);
  const stopped = all.filter((s) => s.status === "stopped").sort(byCost);
  const monthly = round2(active.reduce((sum, s) => sum + s.perMonth, 0));
  return {
    active,
    stopped,
    monthly,
    yearly: round2(monthly * 12),
    paid: round2(all.reduce((sum, s) => sum + s.paid, 0)),
    currency: accounts[0]?.currency ?? "INR",
  };
}
