// Plain-language spending buckets. Every debit lands in one bucket that a
// non-finance person recognises: what it was for when the merchant is known
// (Food, Shopping, Bills...), otherwise how it was paid (UPI, Card, Bank
// transfer, Cash). The Home doughnut and the strip under the bank card both
// use this, so their numbers always match.

export type SpendBucket = { key: string; name: string; amount: number; count: number; share: number };

type Rule = [name: string, pattern: RegExp];

// Purpose first: a recognisable merchant says more than the rail it used.
const PURPOSE: Rule[] = [
  ["EMI & pay later", /snapmint|\bslice\b|sliceit|lazypay|\bsimpl\b|zestmoney|kreditbee|moneyview|bajaj\s*fin|home\s*credit|tata\s*capital|\bnavi\b|\bemi\b|loan|\bbnpl\b/i],
  ["Investments", /\bsip\b|mutual\s*fund|zerodha|groww|upstox|kuvera|\bppf\b|\bnps\b|\blic\b|coin\s*by|indmoney/i],
  ["Rent", /\brent\b|nobroker|housing\.com/i],
  ["Groceries", /bigbasket|blinkit|zepto|instamart|\bdmart\b|reliance\s*fresh|grofers|jiomart|more\s*retail|kirana|supermarket/i],
  ["Food", /swiggy|zomato|eatsure|domino|pizza|mcdonald|\bkfc\b|burger|starbucks|\bcafe\b|coffee|restaurant|dhaba|bakery|food/i],
  ["Shopping", /amazon(?!\s*web)|amzn|flipkart|myntra|meesho|\bajio\b|nykaa|croma|reliance\s*digital|decathlon|ikea|\bshops?\b|sparkfun|climbing/i],
  ["Subscriptions", /netflix|spotify|prime\s*video|hotstar|youtube|apple\.com|google\s*play|subscription|github|microsoft|amazon\s*web|\baws\b/i],
  ["Bills & recharges", /airtel|\bjio\b|vodafone|\bvi\b|bsnl|electricity|bescom|msedcl|tata\s*power|\bbses\b|adani\s*elec|broadband|\bdth\b|tata\s*play|\bgas\b|water\s*bill|recharge|postpaid|prepaid|fastag|utilit/i],
  ["Travel", /\buber\b|\bola\b|rapido|irctc|indigo|air\s*india|vistara|akasa|airlines?|redbus|makemytrip|goibibo|petrol|\bhpcl\b|\bbpcl\b|\biocl\b|indian\s*oil|\bshell\b|\bmetro\b|travel/i],
  ["Health", /pharmacy|apollo|medplus|\b1mg\b|pharmeasy|hospital|clinic|diagnostic|healthcare/i],
  ["Cash (ATM)", /\batm\b|cash\s*wdl|cash\s*withdrawal|\bnwd\b|\bawd\b/i],
];

// Then the rail, in words people use.
const METHOD: Rule[] = [
  ["UPI", /\bupi\b|@ok|@ybl|@paytm|@axl|@ibl|@apl|\bvpa\b|phonepe|gpay|google\s*pay|paytm|bhim/i],
  ["Card", /\bpos\b|\bcard\b|\bvisa\b|mastercard|rupay|\becom\b/i],
  ["Bank transfer", /\bneft\b|\bimps\b|\brtgs\b|\bach\b|\bnach\b|transfer|\btrf\b|\bft\b|\bchq\b|cheque/i],
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

/** The plain-language bucket a debit belongs to. */
export function spendType(t: Pick<Transaction, "name" | "category" | "paymentChannel">): string {
  const text = t.name ?? "";
  for (const [name, pattern] of PURPOSE) if (pattern.test(text)) return name;
  for (const [name, pattern] of METHOD) if (pattern.test(text)) return name;

  const fromCategory = FROM_CATEGORY[(t.category ?? "").toLowerCase()];
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

  const head = sorted.filter((b) => b.name !== "Other").slice(0, limit - 1);
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
