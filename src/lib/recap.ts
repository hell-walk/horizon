import { OWN_TRANSFER } from "./corrections";
import type { Evidence } from "./insights";
import { payeeName } from "./payees";
import { regularKeyOf, type Regular } from "./recurring";
import { spendType } from "./spending";

// "Your week": the last seven days the entries cover, with the biggest spends
// and what is due in the next seven days. Everyday spending is compared with a
// usual week; regular payments (rent, EMIs) are listed on their own, since a
// week with the rent in it is not a week of extra spending.

export type WeekRecap = {
  from: string;
  to: string;
  /** True when the week ends before today: the statements stop there. */
  past: boolean;
  moneyIn: number;
  moneyOut: number;
  /** Money out that is not a regular payment. */
  everydayOut: number;
  /** A usual week's everyday spending (average of up to 8 full weeks before), when there are at least two. */
  usualEveryday?: number;
  weeksCompared: number;
  /** Regular payments that went out this week. */
  regularOut: { name: string; amount: number }[];
  biggest: Evidence[];
  topCategory?: { name: string; amount: number };
  dueNext: { name: string; date: string; amount: number }[];
};

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

export function weeklyRecap(transactions: Transaction[] = [], regulars: Regular[] = [], today = new Date()): WeekRecap | null {
  const regularKeys = new Map(regulars.filter((r) => r.status !== "stopped").map((r) => [r.key, r.name]));
  const rows = transactions
    .map((t) => {
      const out = t.type === "debit" || Number(t.amount) < 0;
      const regular = out ? regularKeys.get(regularKeyOf(t) ?? "") : undefined;
      return { t, day: dayOf(String(t.date ?? "")), amount: Math.abs(Number(t.amount) || 0), out, regular };
    })
    .filter((r) => Number.isFinite(r.day) && r.amount > 0 && r.t.userCategory !== OWN_TRANSFER);
  if (rows.length === 0) return null;

  const todayDay = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY);
  const toDay = Math.min(Math.max(...rows.map((r) => r.day)), todayDay);
  const firstDay = Math.min(...rows.map((r) => r.day));
  const fromDay = toDay - 6;
  const sum = (list: typeof rows) => list.reduce((s, r) => s + r.amount, 0);

  const week = rows.filter((r) => r.day >= fromDay && r.day <= toDay);
  const out = week.filter((r) => r.out);
  const everyday = out.filter((r) => !r.regular);

  // Usual week: everyday spending in whole weeks before this one that the entries cover. A week
  // with no everyday spending at all is a gap in the statements, not a week of no spending.
  const weeks: number[] = [];
  for (let end = fromDay - 1; end - 6 >= firstDay && weeks.length < 8; end -= 7) {
    const spent = rows.filter((r) => r.out && !r.regular && r.day <= end && r.day >= end - 6);
    if (spent.length) weeks.push(sum(spent));
  }

  const byCategory = new Map<string, number>();
  for (const r of out) byCategory.set(spendType(r.t), (byCategory.get(spendType(r.t)) ?? 0) + r.amount);
  const [topName, topAmount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  const dueNext = regulars
    .filter((r) => r.direction === "out" && (r.status === "upcoming" || r.status === "unseen") && dayOf(r.next) <= todayDay + 7)
    .map((r) => ({ name: r.name, date: r.next, amount: r.amount }));

  return {
    from: iso(fromDay),
    to: iso(toDay),
    past: toDay < todayDay,
    moneyIn: round2(sum(week.filter((r) => !r.out))),
    moneyOut: round2(sum(out)),
    everydayOut: round2(sum(everyday)),
    ...(weeks.length >= 2 ? { usualEveryday: round2(weeks.reduce((s, w) => s + w, 0) / weeks.length) } : {}),
    weeksCompared: weeks.length,
    regularOut: out.filter((r) => r.regular).map((r) => ({ name: r.regular!, amount: round2(r.amount) })),
    biggest: out
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((r) => ({ id: r.t.id, date: iso(r.day), name: r.t.shownName || payeeName(r.t.name), amount: round2(r.amount) })),
    ...(topName ? { topCategory: { name: topName, amount: round2(topAmount!) } } : {}),
    dueNext,
  };
}
