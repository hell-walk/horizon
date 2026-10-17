// Bank charges: what the banks themselves took. Minimum-balance penalties,
// SMS alerts, card fees, ATM charges, bounced payments, GST on all of these.
// Found in the bank's wording alone, so it works on any statement and gets
// better for everyone (and for entries imported earlier) when the rules do.
// Money back with the same wording ("SMS CHG REVERSAL") counts as given back.
//
// One list for the saved category (categories.ts: "Bank Fees") and the Bank
// charges page, so the two always agree. tests/unit/charges.test.ts lists
// narrations in the shapes banks print them.

export type ChargeKind =
  "bounce" | "minBalance" | "sms" | "card" | "atm" | "late" | "forex" | "transfer" | "chequeBook" | "cash" | "statement" | "gst" | "other";

/** The words banks use for a charge: CHG, CHGS, CHRG, CHARGES, FEE, PENALTY. */
const CHARGE_WORD = /\b(chg?s?|chrgs?|charges?|fees?|penalty|penal)\b/i;

// Most specific first: "ECS RTN CHGS INCL GST" is a bounce, not GST.
const KINDS: [ChargeKind, RegExp][] = [
  [
    "bounce",
    // A charge word is needed: "CHQ RETURN" alone is the bounced cheque's own amount going back out.
    /\b(rtn|returns?|returned|bounced?|dishono?u?r\w*)\b.*\b(chg?s?|chrgs?|charges?|fees?|penalty)\b|\b(chg?s?|chrgs?|charges?|fees?|penalty)\b.*\b(rtn|returns?|returned|bounced?|dishono?u?r\w*)\b|\binsuff\w*\.?\s*(bal|fund)/i,
  ],
  [
    "minBalance",
    /\b(amb|mab|qab|aqb|mmb|mqb)\b|\bmin(imum)?\.?\s*bal\w*\b|\bav(era)?g\w*\.?\s*(monthly\s*|quarterly\s*)?bal\w*\s*(chg|chrg|charge|fee|penal|non)|non[\s-]*maint|\bnmc\b|\bbal\w*\s*maint\w*\s*(chg|chrg|charge|fee)/i,
  ],
  ["sms", /\bsms\b|\balert\s*(chg|chrg|charge|fee)/i],
  [
    "card",
    /\b(debit|atm|dc|d\s*card)\s*(card\s*)?(annual|amc|issu\w*|renew\w*|replace\w*|maint\w*|fee)|dcardfee|\bcard\s*(annual\s*)?(fee|chg|chrg|charges?|amc)|annual\s*(maint\w*\s*)?(fee|chg|charges?)|\bamc\s*(chg|chrg|charges?|fee)/i,
  ],
  [
    "atm",
    /\batm\b.*\b(chg?s?|chrgs?|charges?|fee|decl\w*)\b|\b(chg?s?|chrgs?|charges?|fee)\b.*\batm\b|excess\s*(atm|wdl|withdrawal|txn)|\bcash\s*wdl\s*(chg|chrg|charge|fee)/i,
  ],
  ["late", /\blate\s*(pay\w*\s*)?(fee|chg|chrg|charges?)|\blpf\b|overdue\s*(int|chg|charges?|fee)|penal\s*int|finance\s*charges?|over\s*limit/i],
  [
    "forex",
    /forex|\bfx\s*mark|mark[\s-]*up|cross\s*curr|\bdcc\b|international\s*(txn|transaction)\s*(fee|chg|charges?)|\bintl\.?\s*(txn\s*)?(fee|chg|charges?)/i,
  ],
  // Not "fee": "IMPS/P2A/.../RAHUL/fees" is money sent with a note.
  ["transfer", /\b(neft|imps|rtgs|fund\s*transfer|ft)\b.*\b(chg?s?|chrgs?|charges?|comm|commission)\b|\b(chg?s?|chrgs?|charges?)\b.*\b(neft|imps|rtgs)\b/i],
  ["chequeBook", /\b(chq|cheque|check)\s*book/i],
  ["cash", /\bcash\s*(dep\w*|handling)\s*(chg|chrg|charges?|fee)|cash\s*handling/i],
  ["statement", /\b(stmt|statement|passbook|duplicate|dup)\b.*\b(chg?s?|chrgs?|charges?|fee)\b/i],
  ["gst", /\b[cis]?gst\b|service\s*tax/i],
];

// A payment to a person or shop, not a charge, even when its note says "fee"
// ("UPI/DR/.../ABC SCHOOL/fees", "NEFT DR ... college fee"); "@" only as part of a UPI
// address, not "GST @18%". A line the bank
// starts with its own charge word ("Chrg: IMPS P2A ...") is still a charge.
const PAYMENT_TO_SOMEONE = /@[a-z]|\bupi\b|\/dr\/|\/cr\/|\bpos\b|\becom\b/i;
const BANK_LINE_START = /^\s*(chrg|chg|charges?)\b/i;
// What people pay others "fees" for, and taxes paid through the bank
// ("GST PMT CPIN ...", "CBDT TDS"), which are not a charge on top of a fee.
const NOT_BANK =
  /school|college|tuition|exam|admission|course|academy|coaching|society|club|hospital|clinic|doctor|lawyer|court|registration|convenience|booking|licen[cs]e|passport|\bvisa\b|challan|\bcpin\b|gstn|\bgst\s*(pmt|payment)|tax\s*pay|income\s*tax|\btds\b|cbdt/i;
// Money back: the bank undoing a charge.
const GIVEN_BACK = /\brev\b|revers|refund|waiv|reimb|\brvsl\b|\brev\.|reversed/i;

/** Which kind of bank charge a description is, or null when it is not one. */
export function chargeKind(text: string): ChargeKind | null {
  if (!text) return null;
  const bankLine = BANK_LINE_START.test(text);
  if (!bankLine && (PAYMENT_TO_SOMEONE.test(text) || NOT_BANK.test(text))) return null;
  const kind = KINDS.find(([, pattern]) => pattern.test(text))?.[0];
  if (kind) return kind;
  // Any other line in the bank's charge words, unless it is money sent somewhere.
  if (CHARGE_WORD.test(text) && (bankLine || !/\b(neft|imps|rtgs|transfer|trf)\b/i.test(text))) return "other";
  return null;
}

export const isBankCharge = (text: string) => chargeKind(text) !== null;

export type ChargeEntry = { id: string; date: string; name: string; amount: number };
export type ChargeGroup = { kind: ChargeKind; amount: number; count: number; refunded: number; entries: ChargeEntry[] };
export type ChargeReport = {
  /** Charged in the window, before anything given back. */
  total: number;
  refunded: number;
  count: number;
  /** The window: the last 12 months the statements cover. */
  from: string;
  to: string;
  months: number;
  groups: ChargeGroup[];
};

const WINDOW_DAYS = 365;
const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Every bank charge in the last 12 months an account's entries cover, grouped
 * by kind, largest first, with what the bank gave back. `months` is how much of
 * that year the statements actually cover, so a page can say "in 4 months".
 */
export function findCharges(transactions: Pick<Transaction, "id" | "date" | "name" | "amount" | "type">[]): ChargeReport | null {
  const dated = transactions.filter((t) => /^\d{4}-\d{2}-\d{2}/.test(t.date ?? ""));
  if (dated.length === 0) return null;
  const to = dated.reduce((last, t) => (t.date > last ? t.date : last), "").slice(0, 10);
  const earliest = dated.reduce((first, t) => (t.date < first ? t.date : first), to).slice(0, 10);
  const start = new Date(Date.parse(to) - WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const from = earliest > start ? earliest : start;

  const groups = new Map<ChargeKind, ChargeGroup>();
  const group = (kind: ChargeKind) => {
    let g = groups.get(kind);
    if (!g) groups.set(kind, (g = { kind, amount: 0, count: 0, refunded: 0, entries: [] }));
    return g;
  };

  for (const t of dated) {
    const date = t.date.slice(0, 10);
    if (date <= start) continue;
    const kind = chargeKind(t.name ?? "");
    if (!kind) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    if (amount === 0) continue;
    const credit = t.type === "credit" || (t.type !== "debit" && Number(t.amount) > 0);
    if (credit) {
      if (GIVEN_BACK.test(t.name)) group(kind).refunded += amount;
      continue;
    }
    const g = group(kind);
    g.amount += amount;
    g.count += 1;
    g.entries.push({ id: t.id, date, name: t.name, amount });
  }

  const list = [...groups.values()]
    .filter((g) => g.count > 0 || g.refunded > 0)
    .map((g) => ({ ...g, amount: round2(g.amount), refunded: round2(g.refunded), entries: g.entries.sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.amount - a.amount);
  const months = Math.max(1, Math.min(12, Math.round((Date.parse(to) - Date.parse(from)) / (30.44 * DAY))));
  return {
    total: round2(list.reduce((s, g) => s + g.amount, 0)),
    refunded: round2(list.reduce((s, g) => s + g.refunded, 0)),
    count: list.reduce((s, g) => s + g.count, 0),
    from,
    to,
    months,
    groups: list,
  };
}
