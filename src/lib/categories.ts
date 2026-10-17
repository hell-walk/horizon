// The category saved with each statement entry (the chip in the transaction
// table). Worked out from the bank's wording alone, so it can be worked out
// again whenever the rules get better: entries read back from the database
// are re-categorised with these rules (providers/manual.ts), and a person's own
// correction always wins over both (corrections.ts).

import { isBankCharge } from "./charges";
import { extraPayLater } from "./extraTerms";

/**
 * EMIs, loan repayments and "pay later". One list for everything that groups
 * payments: the saved category, the spending chart (spending.ts) and the
 * regular-payments finder. Matched against the bank's description, which for
 * UPI includes the payee's UPI address (e.g. "amazonpaylater@...").
 * Add new names here; tests/unit/pay-later.test.ts lists examples.
 *
 * Banks that also lend (HDFC, ICICI, SBI, Axis, Kotak, IDFC FIRST...) are not
 * listed by name: most payments to them are not loans. Their EMIs are found by
 * the words that come with them ("EMI", "LOAN", "INSTALMENT"). The names that
 * are listed are lenders first, where the name alone means a loan.
 */
const PAY_LATER_WORDS = [
  // Plain words
  String.raw`pay\s*later`, "paylater", String.raw`\bemi\b`, String.raw`(?<!sa)loan`, "repay", String.raw`\binstal{1,2}ments?\b`, String.raw`\bbnpl\b`, "flexipay",
  String.raw`\b(nach|ach\s*d)\b.*\b(fin|capital|credit)`,
  // Pay-later wallets and cards
  String.raw`(amazon|flipkart|icici|kotak|hdfc|axis|sbi|simpl|mobikwik)\s*pay\s*later`, String.raw`paytm\s*post\s*paid`, String.raw`ola\s*(money|post\s*paid)`,
  String.raw`mobikwik\s*zip`, String.raw`\bsimpl\b`, "lazypay", "snapmint", String.raw`(?<!pizza\s)\bslice\b`, "sliceit", "slicepay", "quadrillion", String.raw`\buni\s*(pay|card)`,
  // App lenders and NBFCs
  String.raw`zest\s*money`, "kreditbee", String.raw`money\s*view`, String.raw`money\s*tap`, String.raw`(?<!air\s?)\bfibe\b`, "earlysalary", String.raw`\bcashe\b`, "mpokket", "stashfin", "truebalance",
  "paysense", "lendingkart", String.raw`(?<!@)\bnavi\b`, String.raw`bajaj\s*fin`, String.raw`home\s*credit`, String.raw`tata\s*capital`, String.raw`hdb\s*fin`,
  String.raw`aditya\s*birla\s*(fin|capital)`, "fullerton", String.raw`muthoot\s*fin`, String.raw`manappuram`, String.raw`shriram\s*fin`, String.raw`l\s*&\s*t\s*fin`, String.raw`poonawalla`,
  String.raw`\bidfc\s*first\s*bank\s*loan`, "dmi finance", String.raw`kissht`, String.raw`\bring\b.*\bloan`,
  // Vehicle, gold and consumer lenders. Not "Mahindra" alone (a car bought
  // outright) or "Chola" alone (Chola MS is an insurer).
  String.raw`mahindra\s*(&\s*mahindra\s*)?fin`, String.raw`\bmmfsl\b`, String.raw`hero\s*fin\s*corp`, String.raw`tvs\s*credit`, String.raw`cholamandalam\s*(inv|fin)`,
  String.raw`\bchola\s*fin`, String.raw`kotak\s*mahindra\s*prime`, String.raw`sundaram\s*fin`, String.raw`piramal\s*(fin|capital)`, String.raw`\biifl\s*(fin|home|gold|loan)`,
  String.raw`credit\s*saison`, String.raw`\bfreo\b`, String.raw`\bavail\s*fin`, String.raw`indiabulls\s*(hous|consumer|fin)`, String.raw`capital\s*first`, String.raw`muthoot\s*capital`,
  // Elsewhere
  String.raw`\baffirm\b`, "klarna", "afterpay", "clearpay", String.raw`\btabby\b`, String.raw`\btamara\b`, String.raw`\bzip\s*pay`, "sezzle", String.raw`\bpaypal\s*credit`,
];
export const PAY_LATER = new RegExp(PAY_LATER_WORDS.join("|"), "i");

// Banks cut long narrations short: "Paid via" often ends up as "Paid vi",
// which is not the phone company Vi.
const VI = /(?<!paid\s)\bvi\b/i;

/**
 * Is this an EMI, loan or pay-later payment? The built-in names above, plus
 * any the team added from the admin portal (extraTerms.ts).
 */
export const isPayLater = (text: string) => PAY_LATER.test(text) || extraPayLater(text);

// Bank charges come first, so "ECS RTN CHGS BAJAJ FIN" is a charge, not an EMI.
// Both only for money out: the same words on money in are a charge given back
// (charges.ts counts those) or, from a lender, the loan itself arriving.
const CATEGORY_RULES: [matches: (text: string) => boolean, category: string, outOnly?: true][] = [
  [isBankCharge, "Bank Fees", true],
  [(s) => /swiggy|zomato|dominos|mcdonald|starbucks|kfc|pizza|cafe|restaurant|food|bakery|dunkin|subway/i.test(s), "Food and Drink"],
  [(s) => /salary|sal cr|payroll|interest|int\.?\s*cr|dividend|refund|cashback/i.test(s), "Income"],
  [isPayLater, "EMI & pay later", true],
  [(s) => /amazon|flipkart|myntra|ajio|nykaa|bigbasket|blinkit|zepto|dmart|reliance|mart|store/i.test(s), "Shopping"],
  [(s) => /uber|ola|rapido|irctc|indigo|air india|vistara|makemytrip|redbus|metro|fuel|petrol|hpcl|bpcl|ioc/i.test(s), "Travel"],
  [(s) => /netflix|spotify|prime|hotstar|youtube|google|apple|jio|airtel|air\s*fib|bsnl|recharge|broadband|electricity|bescom|tneb|gas|water/i.test(s), "Bills"],
  [(s) => VI.test(s), "Bills"],
  [(s) => /atm|cash wdl|cash withdrawal|cwdr/i.test(s), "Cash"],
  [(s) => /insurance|lic |premium|sip|mutual fund|zerodha|groww|upstox/i.test(s), "Finance"],
  [(s) => /upi|paytm|phonepe|gpay|google pay|bharatpe/i.test(s), "Payment"],
  [(s) => /neft|imps|rtgs|ft\b|transfer|trf/i.test(s), "Transfer"],
];

/** The category for a bank's description of an entry; `type` is "credit" for money in. */
export function categorize(name: string, type?: string) {
  const moneyIn = type === "credit";
  return CATEGORY_RULES.find(([matches, , outOnly]) => !(moneyIn && outOnly) && matches(name))?.[1] ?? "Transfer";
}
