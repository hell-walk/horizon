import { chargeKind } from "./charges";
import { OWN_TRANSFER } from "./corrections";
import { payeeName } from "./payees";
import type { Regular } from "./recurring";
import { spendType } from "./spending";

// EMIs and loans, lender by lender: who the money goes to (a bank, an NBFC, a
// loan app or a pay-later service), what kind of loan it looks like, how much
// a month, since when, whether it bounced, and which usually costs most.
// Worked out from the bank's wording and the regular-payments finder alone;
// Horizon never sees the loan papers, so rates are not known, only the
// usual cost of each kind of loan.

export type LenderKind = "bank" | "nbfc" | "app" | "payLater" | "unknown";
export type LoanType = "home" | "car" | "twoWheeler" | "personal" | "education" | "gold" | "consumer" | "business" | "creditCard" | "payLater";

// `dueDay`: the day of the month the lender takes the bill, only where that is the same
// for every customer and there is something to back it (slice's help page: statement on
// the 27th, due by the 5th; Snapmint: the 3rd, reported by a user). Banks and most apps
// set the day per loan, so they have none: the statements or the person say when.
// `cutoffDay`: borrowing after this day puts the first EMI a month later (Snapmint, after the 26th).
type Lender = { name: string; kind: Exclude<LenderKind, "unknown">; pattern: RegExp; type?: LoanType; dueDay?: number; cutoffDay?: number };

// Most specific first: "ICICI PayLater" before "ICICI Bank", "Kotak Mahindra
// Prime" before "Kotak", "Muthoot Capital" before "Muthoot Finance".
const LENDERS: Lender[] = [
  // Pay later
  { name: "Amazon Pay Later", kind: "payLater", pattern: /amazon\s*pay\s*later/i },
  { name: "Flipkart Pay Later", kind: "payLater", pattern: /flipkart\s*pay\s*later/i },
  { name: "ICICI PayLater", kind: "payLater", pattern: /icici\s*pay\s*later/i },
  { name: "HDFC PayLater", kind: "payLater", pattern: /hdfc\s*pay\s*later/i },
  { name: "Kotak PayLater", kind: "payLater", pattern: /kotak\s*pay\s*later/i },
  { name: "Axis PayLater", kind: "payLater", pattern: /axis\s*pay\s*later/i },
  { name: "SBI PayLater", kind: "payLater", pattern: /sbi\s*pay\s*later/i },
  { name: "Paytm Postpaid", kind: "payLater", pattern: /paytm\s*post\s*paid/i },
  { name: "Ola Money Postpaid", kind: "payLater", pattern: /ola\s*(money|post\s*paid)/i },
  { name: "MobiKwik ZIP", kind: "payLater", pattern: /mobikwik\s*(zip|pay\s*later)/i },
  { name: "Simpl", kind: "payLater", pattern: /\bsimpl\b/i },
  { name: "LazyPay", kind: "payLater", pattern: /lazy\s*pay/i },
  { name: "Snapmint", kind: "payLater", pattern: /snapmint/i, dueDay: 3, cutoffDay: 26 },
  { name: "slice", kind: "payLater", pattern: /(?<!pizza\s)\bslice\b|sliceit|slicepay|quadrillion/i, dueDay: 5 },
  { name: "Uni", kind: "payLater", pattern: /\buni\s*(pay|card)/i },
  // Loan apps
  { name: "KreditBee", kind: "app", pattern: /kreditbee/i, type: "personal" },
  { name: "Fibe", kind: "app", pattern: /(?<!air\s?)\bfibe\b|earlysalary/i, type: "personal" },
  { name: "Moneyview", kind: "app", pattern: /money\s*view/i, type: "personal" },
  { name: "MoneyTap", kind: "app", pattern: /money\s*tap/i, type: "personal" },
  { name: "CASHe", kind: "app", pattern: /\bcashe\b/i, type: "personal" },
  { name: "mPokket", kind: "app", pattern: /mpokket/i, type: "personal" },
  { name: "Stashfin", kind: "app", pattern: /stashfin/i, type: "personal" },
  { name: "True Balance", kind: "app", pattern: /truebalance|true\s*balance/i, type: "personal" },
  { name: "PaySense", kind: "app", pattern: /paysense/i, type: "personal" },
  { name: "Navi", kind: "app", pattern: /(?<!@)\bnavi\b/i },
  { name: "ZestMoney", kind: "app", pattern: /zest\s*money/i, type: "consumer" },
  { name: "Kissht", kind: "app", pattern: /kissht|\bring\b.*\bloan/i, type: "personal" },
  { name: "Freo", kind: "app", pattern: /\bfreo\b/i, type: "personal" },
  { name: "Avail Finance", kind: "app", pattern: /\bavail\s*fin/i, type: "personal" },
  { name: "Lendingkart", kind: "app", pattern: /lendingkart/i, type: "business" },
  { name: "DMI Finance", kind: "app", pattern: /dmi\s*finance/i, type: "consumer" },
  // NBFCs and housing finance
  { name: "Bajaj Finance", kind: "nbfc", pattern: /bajaj\s*fin/i },
  { name: "Home Credit", kind: "nbfc", pattern: /home\s*credit/i, type: "consumer" },
  { name: "Tata Capital", kind: "nbfc", pattern: /tata\s*capital/i },
  { name: "HDB Financial Services", kind: "nbfc", pattern: /hdb\s*fin/i },
  { name: "Aditya Birla Finance", kind: "nbfc", pattern: /aditya\s*birla\s*(fin|capital)/i },
  { name: "Mahindra Finance", kind: "nbfc", pattern: /mahindra\s*(&\s*mahindra\s*|and\s*mahindra\s*)?fin|\bmmfsl\b/i, type: "car" },
  { name: "Kotak Mahindra Prime", kind: "nbfc", pattern: /kotak\s*mahindra\s*prime/i, type: "car" },
  { name: "Hero FinCorp", kind: "nbfc", pattern: /hero\s*fin\s*corp/i, type: "twoWheeler" },
  { name: "TVS Credit", kind: "nbfc", pattern: /tvs\s*credit/i, type: "twoWheeler" },
  { name: "Cholamandalam Finance", kind: "nbfc", pattern: /cholamandalam\s*(inv|fin)|\bchola\s*fin/i },
  { name: "Sundaram Finance", kind: "nbfc", pattern: /sundaram\s*fin/i },
  { name: "Shriram Finance", kind: "nbfc", pattern: /shriram\s*fin/i },
  { name: "L&T Finance", kind: "nbfc", pattern: /l\s*&\s*t\s*fin/i },
  { name: "Poonawalla Fincorp", kind: "nbfc", pattern: /poonawalla/i },
  { name: "Piramal Finance", kind: "nbfc", pattern: /piramal\s*(fin|capital)/i },
  { name: "IIFL Finance", kind: "nbfc", pattern: /\biifl\s*(fin|home|gold|loan)/i },
  { name: "Muthoot Capital", kind: "nbfc", pattern: /muthoot\s*capital/i, type: "twoWheeler" },
  { name: "Muthoot Finance", kind: "nbfc", pattern: /muthoot\s*fin/i, type: "gold" },
  { name: "Manappuram Finance", kind: "nbfc", pattern: /manappuram/i, type: "gold" },
  { name: "Fullerton India", kind: "nbfc", pattern: /fullerton/i, type: "personal" },
  { name: "Credit Saison", kind: "nbfc", pattern: /credit\s*saison/i },
  { name: "Indiabulls", kind: "nbfc", pattern: /indiabulls\s*(hous|consumer|fin)/i },
  { name: "Capital First", kind: "nbfc", pattern: /capital\s*first/i },
  { name: "LIC Housing Finance", kind: "nbfc", pattern: /lic\s*(hfl|housing)/i, type: "home" },
  { name: "PNB Housing Finance", kind: "nbfc", pattern: /pnb\s*housing/i, type: "home" },
  // Banks: only reached for a line that is already an EMI (they are not lenders by name alone).
  { name: "HDFC Bank", kind: "bank", pattern: /\bhdfc\b/i },
  { name: "ICICI Bank", kind: "bank", pattern: /\bicici\b/i },
  { name: "State Bank of India", kind: "bank", pattern: /\bsbi\b|state\s*bank\s*of\s*india/i },
  { name: "Axis Bank", kind: "bank", pattern: /\baxis\b/i },
  { name: "Kotak Mahindra Bank", kind: "bank", pattern: /\bkotak\b/i },
  { name: "IDFC FIRST Bank", kind: "bank", pattern: /\bidfc\b/i },
  { name: "Yes Bank", kind: "bank", pattern: /\byes\s*bank\b/i },
  { name: "IndusInd Bank", kind: "bank", pattern: /indusind/i },
  { name: "AU Small Finance Bank", kind: "bank", pattern: /\bau\s*(small|sfb|bank)/i },
  { name: "Bank of Baroda", kind: "bank", pattern: /bank\s*of\s*baroda|\bbob\b/i },
  { name: "Punjab National Bank", kind: "bank", pattern: /\bpnb\b|punjab\s*national/i },
  { name: "Canara Bank", kind: "bank", pattern: /canara/i },
  { name: "Union Bank of India", kind: "bank", pattern: /union\s*bank/i },
  { name: "Bank of India", kind: "bank", pattern: /bank\s*of\s*india/i },
  { name: "Federal Bank", kind: "bank", pattern: /federal\s*bank/i },
  { name: "RBL Bank", kind: "bank", pattern: /\brbl\b/i },
  { name: "IDBI Bank", kind: "bank", pattern: /\bidbi\b/i },
  { name: "Indian Bank", kind: "bank", pattern: /\bindian\s*bank\b/i },
];

// The loan's purpose, when the bank's wording says it.
const TYPES: [LoanType, RegExp][] = [
  ["creditCard", /credit\s*card\s*emi|\bcc\s*emi|card\s*emi|emi\s*conv/i],
  ["home", /home\s*loan|housing|\bhl\b|\bhome\s*fin/i],
  ["twoWheeler", /two\s*wheeler|\b2\s*w\b|\btw\s*loan|bike\s*loan/i],
  ["car", /car\s*loan|auto\s*loan|vehicle|\bcv\s*loan/i],
  ["education", /education|edu\.?\s*loan|student\s*loan/i],
  ["gold", /gold\s*loan/i],
  ["business", /business\s*loan|\bbl\s*emi|msme/i],
  ["personal", /personal\s*loan|\bpl\s*emi|\bpl\b.*\bemi/i],
  ["consumer", /consumer\s*(durable|loan)|\bcd\s*loan|emi\s*card|no\s*cost\s*emi/i],
];

/** The lender named in a bank's description, if Horizon knows it. */
export function lenderOf(text: string): { name: string; kind: Exclude<LenderKind, "unknown">; type?: LoanType; dueDay?: number; cutoffDay?: number } | null {
  const found = LENDERS.find((l) => l.pattern.test(text));
  return found ? { name: found.name, kind: found.kind, type: found.type, dueDay: found.dueDay, cutoffDay: found.cutoffDay } : null;
}

/** The lender's usual due day and cut-off day, by its name as Horizon shows it. */
export function lenderDays(name: string): { dueDay?: number; cutoffDay?: number } {
  const found = LENDERS.find((l) => l.name === name);
  return found ? { dueDay: found.dueDay, cutoffDay: found.cutoffDay } : {};
}

/** The next time a monthly due day comes round after a date (the month's last day when it is shorter). */
export function nextDueAfter(date: string, dueDay: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + (d.getUTCDate() >= dueDay ? 1 : 0);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dueDay, last))).toISOString().slice(0, 10);
}

/** The kind of loan a description points to: its own words first, then what the lender mostly lends for. */
export function loanTypeOf(text: string, lender = lenderOf(text)): LoanType | null {
  if (lender?.kind === "payLater") return "payLater";
  return TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? lender?.type ?? null;
}

/**
 * Usually costliest first. Pay-later and app loans carry the highest effective
 * rates and late fees; home and education loans the lowest (and tax relief).
 * A guide only: the real rate is in the loan papers.
 */
const COST_RANK: Record<LoanType | "unknown", number> = {
  payLater: 1,
  creditCard: 1,
  personal: 2,
  consumer: 2,
  business: 2,
  unknown: 3,
  twoWheeler: 3,
  car: 4,
  gold: 4,
  education: 5,
  home: 6,
};
export type CostBand = "high" | "medium" | "low";
const costBand = (rank: number): CostBand => (rank <= 2 ? "high" : rank <= 4 ? "medium" : "low");

export type LoanEntry = { id: string; date: string; name: string; amount: number };
export type Loan = {
  key: string;
  lender: string;
  /** False when the lender is not one Horizon knows: the name is the payee from the bank's wording. */
  known: boolean;
  kind: LenderKind;
  type: LoanType | null;
  currency: string;
  /** About this much a month: the steady EMI when there is one, else the average over the months paid. */
  monthly: number;
  /** A steady monthly (or other) rhythm was found. */
  steady: boolean;
  status: "active" | "missed" | "ended";
  /** Paid in the last 12 months the statements cover. */
  paid: number;
  count: number;
  first: string;
  last: string;
  next?: string;
  /** The next date came from the lender's usual day, not from a rhythm in the statements (one payment so far). */
  nextLikely?: boolean;
  /** Money that came in from this lender (the loan itself, most likely). */
  borrowed: number;
  /** Failed payments and what the bank charged for them. */
  bounces: number;
  bounceCharges: number;
  cost: CostBand;
  entries: LoanEntry[];
};

export type LoanReport = {
  loans: Loan[];
  /** Active loans, usually costliest first: the order to pay down extra. */
  closeFirst: string[];
  /** Monthly EMIs of active loans, per currency. */
  monthly: Record<string, number>;
  /** Regular income a month (salary and the like), per currency. */
  income: Record<string, number>;
  activeCount: number;
  /** Active pay-later services and loan apps: several at once is a warning sign. */
  quickCreditCount: number;
  bounces: number;
};

export type AccountInput = { currency: string; transactions: Transaction[]; regular: Regular[] };

const WINDOW_DAYS = 365;
const ENDED_AFTER_DAYS = 45;
const DAY = 86_400_000;
const ENTRIES_SHOWN = 24;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isDebit = (t: Pick<Transaction, "type" | "amount">) => t.type === "debit" || (t.type !== "credit" && Number(t.amount) < 0);
const GIVEN_BACK = /\brev\b|revers|refund|cashback|\brvsl\b/i;

/** Every EMI, loan and pay-later lender across a person's accounts. */
export function findLoans(accounts: AccountInput[]): LoanReport {
  type Group = Omit<Loan, "monthly" | "steady" | "status" | "next" | "cost" | "first" | "last"> & {
    days: string[];
    regulars: Map<string, Regular>;
    lastCovered: string;
  };
  const groups = new Map<string, Group>();
  const income: Record<string, number> = {};
  let bounces = 0;
  // Bounce charges naming a lender, attached once every payment is grouped (statements are not in date order).
  const lenderBounces: { key: string; amount: number }[] = [];

  for (const { currency, transactions, regular } of accounts) {
    const dated = transactions.filter((t) => /^\d{4}-\d{2}-\d{2}/.test(t.date ?? ""));
    if (dated.length === 0) continue;
    const lastCovered = dated.reduce((last, t) => (t.date > last ? t.date : last), "").slice(0, 10);
    const start = new Date(Date.parse(lastCovered) - WINDOW_DAYS * DAY).toISOString().slice(0, 10);
    const regularOf = new Map<string, Regular>();
    for (const r of regular) if (r.kind === "emi") for (const s of r.seen) regularOf.set(s.id, r);
    for (const r of regular) if (r.kind === "income" && r.status !== "stopped") income[currency] = round2((income[currency] ?? 0) + r.perMonth);

    for (const t of dated) {
      const date = t.date.slice(0, 10);
      if (date <= start || t.userCategory === OWN_TRANSFER) continue;
      const text = t.name ?? "";
      const amount = Math.abs(Number(t.amount) || 0);
      if (!amount) continue;
      const charge = chargeKind(text);
      const lender = lenderOf(text);
      const debit = isDebit(t);

      // A bounce charge that names a lender belongs to that lender's story.
      if (charge) {
        if (charge === "bounce" && debit) {
          bounces++;
          if (lender) lenderBounces.push({ key: `${lender.name}|${currency}`, amount });
        }
        continue;
      }

      const isLoanPayment = debit && spendType(t) === "EMI & pay later";
      // Money in from a known non-bank lender: the loan arriving (banks pay in salaries and refunds too).
      const isFromLender = !debit && lender && lender.kind !== "bank" && !GIVEN_BACK.test(text);
      if (!isLoanPayment && !isFromLender) continue;

      const name = lender?.name ?? (t.shownName || payeeName(text));
      const key = `${name}|${currency}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          lender: name,
          known: Boolean(lender),
          kind: lender?.kind ?? "unknown",
          type: null,
          currency,
          paid: 0,
          count: 0,
          borrowed: 0,
          bounces: 0,
          bounceCharges: 0,
          entries: [],
          days: [],
          regulars: new Map(),
          lastCovered,
        };
        groups.set(key, g);
      }
      if (lastCovered > g.lastCovered) g.lastCovered = lastCovered;
      if (isFromLender) {
        g.borrowed = round2(g.borrowed + amount);
        continue;
      }
      g.type ??= loanTypeOf(text, lender);
      g.paid = round2(g.paid + amount);
      g.count++;
      g.days.push(date);
      g.entries.push({ id: t.id, date, name: text, amount });
      const r = regularOf.get(t.id);
      if (r) g.regulars.set(r.key, r);
    }
  }

  for (const { key, amount } of lenderBounces) {
    const g = groups.get(key);
    if (!g) continue;
    g.bounces++;
    g.bounceCharges = round2(g.bounceCharges + amount);
  }

  const loans: Loan[] = [...groups.values()]
    .filter((g) => g.count > 0)
    .map(({ days, regulars, lastCovered, ...g }) => {
      days.sort();
      const first = days[0];
      const last = days[days.length - 1];
      // Irregular payments (pay later): averaged over the calendar months from the first one to where the statements end.
      const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
      const months = Math.max(1, monthIndex(lastCovered) - monthIndex(first) + 1);
      // Two loans with one lender (an EMI card and a personal loan) are two steady payments: they add up.
      const steady = [...regulars.values()];
      const live = steady.filter((r) => r.status !== "stopped");
      const status: Loan["status"] = steady.length
        ? live.length === 0
          ? "ended"
          : live.every((r) => r.status === "missed")
            ? "missed"
            : "active"
        : (Date.parse(lastCovered) - Date.parse(last)) / DAY > ENDED_AFTER_DAYS
          ? "ended"
          : "active";
      const next = live.map((r) => r.next).sort()[0];
      // One payment so far: no rhythm yet, but the lender's usual day says when the next one is likely.
      const usual = status !== "ended" && !next ? lenderDays(g.lender).dueDay : undefined;
      const likely = usual ? nextDueAfter(last, usual) : undefined;
      return {
        ...g,
        first,
        last,
        monthly: round2(steady.length ? (live.length ? live : steady).reduce((sum, r) => sum + r.perMonth, 0) : g.paid / months),
        steady: steady.length > 0,
        status,
        ...(next && status !== "ended" ? { next } : likely ? { next: likely, nextLikely: true } : {}),
        cost: costBand(COST_RANK[g.type ?? "unknown"]),
        entries: g.entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, ENTRIES_SHOWN),
      };
    })
    .sort((a, b) => Number(a.status === "ended") - Number(b.status === "ended") || b.monthly - a.monthly);

  const active = loans.filter((l) => l.status !== "ended");
  const monthly: Record<string, number> = {};
  for (const l of active) monthly[l.currency] = round2((monthly[l.currency] ?? 0) + l.monthly);
  const closeFirst = [...active].sort((a, b) => COST_RANK[a.type ?? "unknown"] - COST_RANK[b.type ?? "unknown"] || b.monthly - a.monthly).map((l) => l.key);

  return {
    loans,
    closeFirst,
    monthly,
    income,
    activeCount: active.length,
    quickCreditCount: active.filter((l) => l.kind === "payLater" || l.kind === "app").length,
    bounces,
  };
}

export type LoadBand = "ok" | "stretched" | "heavy";
/**
 * EMIs as a share of regular income. Lenders usually look for all EMIs to stay
 * under about 40 to 50% of income; past half, one bad month means a bounce.
 */
export const loadBand = (share: number): LoadBand => (share < 0.3 ? "ok" : share <= 0.5 ? "stretched" : "heavy");
