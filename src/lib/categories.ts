// The category saved with each statement entry (the chip in the transaction
// table). Worked out from the bank's wording alone, so it can be worked out
// again whenever the rules get better: entries read back from the database
// are re-categorised with these rules (providers/manual.ts), and a person's own
// correction always wins over both (corrections.ts).

/**
 * EMIs, loan repayments and "pay later". One list for everything that groups
 * payments: the saved category, the spending chart (spending.ts) and the
 * regular-payments finder. Matched against the bank's description, which for
 * UPI includes the payee's UPI address (e.g. "amazonpaylater@...").
 * Add new names here; tests/unit/pay-later.test.ts lists examples.
 */
const PAY_LATER_WORDS = [
  // Plain words
  String.raw`pay\s*later`, "paylater", String.raw`\bemi\b`, "loan", "repay", String.raw`\bbnpl\b`, "flexipay", String.raw`\bnach\b.*\b(fin|capital|credit)`,
  // Pay-later wallets and cards
  String.raw`(amazon|flipkart|icici|kotak|hdfc|axis|sbi|simpl|mobikwik)\s*pay\s*later`, String.raw`paytm\s*post\s*paid`, String.raw`ola\s*(money|post\s*paid)`,
  String.raw`mobikwik\s*zip`, String.raw`\bsimpl\b`, "lazypay", "snapmint", String.raw`(?<!pizza\s)\bslice\b`, "sliceit", "slicepay", "quadrillion", String.raw`\buni\s*(pay|card)`,
  // App lenders and NBFCs
  "zestmoney", "kreditbee", "moneyview", String.raw`money\s*tap`, String.raw`(?<!air\s?)\bfibe\b`, "earlysalary", String.raw`\bcashe\b`, "mpokket", "stashfin", "truebalance",
  "paysense", "lendingkart", String.raw`\bnavi\b`, String.raw`bajaj\s*fin`, String.raw`home\s*credit`, String.raw`tata\s*capital`, String.raw`hdb\s*fin`,
  String.raw`aditya\s*birla\s*(fin|capital)`, "fullerton", String.raw`muthoot\s*fin`, String.raw`manappuram`, String.raw`shriram\s*fin`, String.raw`l\s*&\s*t\s*fin`, String.raw`poonawalla`,
  String.raw`\bidfc\s*first\s*bank\s*loan`, "dmi finance", String.raw`kissht`, String.raw`\bring\b.*\bloan`,
  // Elsewhere
  String.raw`\baffirm\b`, "klarna", "afterpay", "clearpay", String.raw`\btabby\b`, String.raw`\btamara\b`, String.raw`\bzip\s*pay`, "sezzle", String.raw`\bpaypal\s*credit`,
];
export const PAY_LATER = new RegExp(PAY_LATER_WORDS.join("|"), "i");

// Banks cut long narrations short: "Paid via" often ends up as "Paid vi",
// which is not the phone company Vi.
const VI = /(?<!paid\s)\bvi\b/i;

const CATEGORY_RULES: [RegExp, string][] = [
  [/swiggy|zomato|dominos|mcdonald|starbucks|kfc|pizza|cafe|restaurant|food|bakery|dunkin|subway/i, "Food and Drink"],
  [/salary|sal cr|payroll|interest|int\.?\s*cr|dividend|refund|cashback/i, "Income"],
  [PAY_LATER, "EMI & pay later"],
  [/amazon|flipkart|myntra|ajio|nykaa|bigbasket|blinkit|zepto|dmart|reliance|mart|store/i, "Shopping"],
  [/uber|ola|rapido|irctc|indigo|air india|vistara|makemytrip|redbus|metro|fuel|petrol|hpcl|bpcl|ioc/i, "Travel"],
  [/netflix|spotify|prime|hotstar|youtube|google|apple|jio|airtel|air\s*fib|bsnl|recharge|broadband|electricity|bescom|tneb|gas|water/i, "Bills"],
  [VI, "Bills"],
  [/atm|cash wdl|cash withdrawal|cwdr/i, "Cash"],
  [/insurance|lic |premium|sip|mutual fund|zerodha|groww|upstox/i, "Finance"],
  [/charge|fee|gst|penalty|sms chg|amb chg/i, "Bank Fees"],
  [/upi|paytm|phonepe|gpay|google pay|bharatpe/i, "Payment"],
  [/neft|imps|rtgs|ft\b|transfer|trf/i, "Transfer"],
];

/** The category for a bank's description of an entry. */
export function categorize(name: string) {
  return CATEGORY_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "Transfer";
}
