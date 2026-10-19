import { isPayLater } from "./categories";
import { isBankCharge } from "./charges";
import { OWN_TRANSFER } from "./corrections";
import { extraSubscription } from "./extraTerms";
import { isPersonPayment, PEOPLE_GROUP, type PayeeSpend } from "./payees";

// Plain-language spending buckets. Every debit lands in one bucket that a
// non-finance person recognises: what it was for when the merchant is known
// (Food, Shopping, Bills...), otherwise how it was paid (UPI, Card, Bank
// transfer, Cash). The Home doughnut and the strip under the bank card both
// use this, so their numbers always match.

export type SpendBucket = { key: string; name: string; amount: number; count: number; share: number };

// A bucket and what puts an entry in it: a pattern, or a function where the
// team's added names (extraTerms.ts) count too.
type Rule = [name: string, pattern: RegExp | ((text: string) => boolean)];
const matches = (pattern: Rule[1], text: string) => (typeof pattern === "function" ? pattern(text) : pattern.test(text));

// Purpose first: a recognisable merchant says more than the rail it used.
// Each rule lists Indian names first, then those common in the US, UK, Europe,
// the Gulf, Singapore and Australia. Order matters: "Uber Eats" is Food before
// "Uber" is Travel; "Whole Foods" is Groceries before "food" is Food.
const PURPOSE: Rule[] = [
  // What the bank itself took, before the lender it names ("ECS RTN CHGS KREDITBEE" is a fee, not an EMI).
  ["Bank Fees", isBankCharge],
  ["EMI & pay later", isPayLater],
  [
    "Investments",
    /\bsip\b|mutual\s*fund|zerodha|groww|upstox|kuvera|demat|\bcdsl\b|\bnsdl\b|broking|\bsbi\s*caps?\b|\bppf\b|\bnps\b|\blic\b|coin\s*by|indmoney|vanguard|fidelity|schwab|robinhood|e\*?trade|coinbase|trading\s*212|hargreaves|\bisa\b/i,
  ],
  ["Rent", /\brent\b|nobroker|housing\.com|letting|landlord|miete|loyer/i],
  [
    "Groceries",
    /bigbasket|blinkit|zepto|instamart|\bdmart\b|reliance\s*fresh|grofers|jiomart|more\s*retail|kirana|supermarket|walmart|\btarget\b|kroger|costco|safeway|whole\s*foods|trader\s*joe|\baldi\b|\blidl\b|tesco|sainsbury|\basda\b|morrisons|waitrose|carrefour|\brewe\b|edeka|albert\s*heijn|mercadona|\bcoles\b|woolworths|fairprice|\bntuc\b|lulu\s*hyper|spinneys/i,
  ],
  [
    "Food",
    /swiggy|zomato|eatsure|domino|pizza|mcdonald|\bkfc\b|burger|starbucks|\bcafe\b|coffee|restaurant|dhaba|bakery|food|uber\s*eats|doordash|grubhub|deliveroo|just\s*eat|talabat|grab\s*food|foodpanda|chipotle|subway|dunkin|taco\s*bell|\bpret\b|greggs|nando/i,
  ],
  [
    "Shopping",
    /amazon(?!\s*web)|amzn|flipkart|myntra|meesho|\bajio\b|nykaa|croma|reliance\s*digital|decathlon|ikea|\bshops?\b|sparkfun|climbing|\bebay\b|etsy|best\s*buy|home\s*depot|argos|john\s*lewis|zalando|shein|\btemu\b|aliexpress|\bnoon\b|lazada|shopee/i,
  ],
  [
    "Subscriptions",
    (text) =>
      /netflix|spotify|prime\s*video|hotstar|youtube|crunchyroll|ellation|sony\s*liv|\bzee5\b|jio\s*cinema|jiohotstar|\bvoot\b|mx\s*player|erosnow|altbalaji|hoichoi|sun\s*nxt|gaana|jiosaavn|wynk|apple\s*music|apple\.com|google\s*play|play\s*store|playstore|subscription|github|microsoft|amazon\s*web|\baws\b|\bhulu\b|disney|\bhbo\b|paramount|peacock|audible|icloud|dropbox|adobe|openai|patreon|duolingo/i.test(
        text,
      ) || extraSubscription(text),
  ],
  [
    "Bills & recharges",
    /airtel|air\s*fib|\bjio\b|vodafone|(?<!paid\s)\bvi\b|bsnl|electricity|bescom|msedcl|tata\s*power|\bbses\b|adani\s*elec|broadband|\bdth\b|tata\s*play|\bgas\b|water\s*bill|rechar|postpaid|prepaid|fastag|utilit|comcast|xfinity|verizon|at\s*&\s*t|t-?mobile|spectrum|pg\s*&\s*e|con\s*ed|british\s*gas|octopus\s*energy|thames\s*water|virgin\s*media|council\s*tax|etisalat|\bdewa\b|singtel|optus|telstra/i,
  ],
  [
    "Travel",
    /\buber\b|\bola\b|rapido|irctc|indigo|air\s*india|vistara|akasa|airlines?|redbus|makemytrip|goibibo|petrol|\bhpcl\b|\bbpcl\b|\biocl\b|indian\s*oil|\bshell\b|\bmetro\b|travel|\blyft\b|amtrak|ryanair|easyjet|british\s*airways|emirates|qatar\s*air|lufthansa|airbnb|booking\.com|expedia|\bgrab\b|careem|\bbolt\b|\btfl\b|chevron|exxon|\bbp\b|trainline/i,
  ],
  ["Health", /pharmacy|apollo|medplus|\b1mg\b|pharmeasy|hospital|clinic|diagnostic|healthcare|\bcvs\b|walgreens|\bboots\b|rite\s*aid|apotheke|pharmacie/i],
  ["Cash (ATM)", /\batm\b|cash\s*wdl|cash\s*withdrawal|\bnwd\b|\bawd\b|geldautomat|bargeld/i],
];

// Then the rail, in words people use.
const METHOD: Rule[] = [
  [PEOPLE_GROUP, /\bupi\b|@ok|@ybl|@paytm|@axl|@ibl|@apl|\bvpa\b|phonepe|gpay|google\s*pay|paytm|bhim/i],
  ["Card", /\bpos\b|\bcard\b|\bvisa\b|mastercard|rupay|\becom\b|contactless|kartenzahlung|carte\s*bancaire/i],
  [
    "Bank transfer",
    /\bneft\b|\bimps\b|\brtgs\b|\bach\b|\bnach\b|transfer|\btrf\b|\bft\b|\bchq\b|cheque|\bzelle\b|venmo|paypal|\bwire\b|\bsepa\b|faster\s*payment|\bbacs\b|interac|paynow|uberweisung|virement|lastschrift/i,
  ],
];

// Provider category names (Plaid and the statement parser) mapped to the same words.
const FROM_CATEGORY: Record<string, string> = {
  "food and drink": "Food",
  food: "Food",
  travel: "Travel",
  shops: "Shopping",
  shopping: "Shopping",
  transfer: "Bank transfer",
  recreation: "Shopping",
  healthcare: "Health",
  service: "Bills & recharges",
  utilities: "Bills & recharges",
  entertainment: "Subscriptions",
  rent: "Rent",
};

// Categories that say nothing about what was bought (the statement parser's default is "Transfer").
const GENERIC_CATEGORIES = new Set(["", "transfer", "payment", "other", "bank fees"]);

/** The plain-language bucket a debit belongs to. The user's own choice wins. */
export function spendType(t: Pick<Transaction, "name" | "category" | "paymentChannel" | "userCategory">): string {
  if (t.userCategory) return t.userCategory;
  const text = t.name ?? "";
  for (const [name, pattern] of PURPOSE) if (matches(pattern, text)) return name;
  for (const [name, pattern] of METHOD) if (matches(pattern, text)) return name;

  // A bare person's name with only a generic category: money sent to someone.
  const category = (t.category ?? "").toLowerCase();
  if (GENERIC_CATEGORIES.has(category) && isPersonPayment(text)) return PEOPLE_GROUP;

  const fromCategory = FROM_CATEGORY[category];
  if (fromCategory) return fromCategory;
  if (t.paymentChannel === "in store") return "Card";
  return "Other";
}

/** Debits grouped into plain-language buckets, largest first, tail folded into "Other". */
export function groupBySpendType(transactions: Transaction[] = [], limit = 5): SpendBucket[] {
  const totals = new Map<string, SpendBucket>();
  let total = 0;

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (!isDebit || amount === 0) continue;

    const name = spendType(t);
    if (name === OWN_TRANSFER) continue; // moving money between your own accounts is not spending
    const bucket = totals.get(name) ?? { key: name.toLowerCase(), name, amount: 0, count: 0, share: 0 };
    bucket.amount += amount;
    bucket.count += 1;
    totals.set(name, bucket);
    total += amount;
  }

  // "Other" always goes last so it reads as the remainder, not a category.
  const sorted = [...totals.values()].sort((a, b) => (a.name === "Other" ? 1 : b.name === "Other" ? -1 : b.amount - a.amount));
  for (const b of sorted) b.share = total ? b.amount / total : 0;
  if (sorted.length <= limit) return sorted;

  // EMIs and pay-later are money already promised: always shown on their own,
  // however small, never hidden inside "Other".
  const pinned = sorted.filter((b) => b.name === "EMI & pay later");
  const head = [...pinned, ...sorted.filter((b) => b.name !== "Other" && !pinned.includes(b)).slice(0, limit - 1 - pinned.length)].sort(
    (a, b) => b.amount - a.amount,
  );
  const rest = sorted.filter((b) => !head.includes(b));
  return [
    ...head,
    {
      key: "other",
      name: "Other",
      amount: rest.reduce((s, b) => s + b.amount, 0),
      count: rest.reduce((s, b) => s + b.count, 0),
      share: rest.reduce((s, b) => s + b.share, 0),
    },
  ];
}

/**
 * The same buckets as groupBySpendType (so the Home chart and Account history
 * agree), each with its own debits: Account history lists or opens them.
 */
export function groupBySpendTypeWithEntries(transactions: Transaction[] = [], limit = 8): PayeeSpend[] {
  const buckets = groupBySpendType(transactions, limit);
  const shown = new Set(buckets.filter((b) => b.name !== "Other").map((b) => b.name));
  const entries = new Map<string, Transaction[]>(buckets.map((b) => [b.name, []]));
  for (const t of transactions) {
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (!isDebit || !Math.abs(Number(t.amount) || 0)) continue;
    const name = spendType(t);
    if (name === OWN_TRANSFER) continue;
    const bucket = shown.has(name) ? name : "Other";
    entries.get(bucket)?.push(t);
  }
  return buckets.map((b) => ({ ...b, transactions: entries.get(b.name) ?? [] }));
}

export type UpiSplit = {
  people: { amount: number; count: number };
  shops: { amount: number; count: number };
};

/**
 * What sits inside "UPI payments": money sent to people (a bare name) versus
 * UPI payments to shops and services the app does not recognise.
 */
export function splitUpi(transactions: Transaction[] = []): UpiSplit {
  const split: UpiSplit = { people: { amount: 0, count: 0 }, shops: { amount: 0, count: 0 } };
  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (!isDebit || amount === 0 || spendType(t) !== PEOPLE_GROUP) continue;
    const side = isPersonPayment(t.name || "") ? split.people : split.shops;
    side.amount += amount;
    side.count += 1;
  }
  return split;
}
