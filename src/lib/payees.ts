// Groups spending by who was paid. Statement narrations carry the merchant in
// a predictable place ("UPI/DR/531/ZOMATO", "NEFT/CR/INFOSYS LTD/SALARY",
// "Swiggy order"), so the name is cleaned of rails, codes and reference
// numbers and repeats fall into one bracket.

export type PayeeSpend = {
  key: string;
  name: string;
  amount: number;
  count: number;
  share: number;
  transactions: Transaction[];
};

// Tokens that describe the rail or the direction, never the payee.
const NOISE = new Set([
  "upi", "neft", "imps", "rtgs", "ach", "nach", "ecs", "pos", "atm", "dr", "cr", "txn", "ref", "id", "no", "chq", "cheque",
  "payment", "paid", "purchase", "transfer", "trf", "to", "from", "by", "via", "the", "and", "ltd", "limited", "pvt", "private",
  "india", "ind", "in", "order", "bill", "online", "card", "debit", "credit", "autopay", "mandate", "emi", "settlement", "wdl", "withdrawal", "cash",
]);

// Well-known merchants: any narration containing the key gets the label.
const ALIASES: [RegExp, string][] = [
  [/swiggy/i, "Swiggy"],
  [/zomato/i, "Zomato"],
  [/amazon|amzn/i, "Amazon"],
  [/flipkart/i, "Flipkart"],
  [/netflix/i, "Netflix"],
  [/spotify/i, "Spotify"],
  [/youtube|google\s*play|google\b/i, "Google"],
  [/apple/i, "Apple"],
  [/uber/i, "Uber"],
  [/\bola\b/i, "Ola"],
  [/rapido/i, "Rapido"],
  [/irctc/i, "IRCTC"],
  [/indigo|air\s*india|vistara|akasa/i, "Airlines"],
  [/airtel/i, "Airtel"],
  [/\bjio\b/i, "Jio"],
  [/\bvi\b|vodafone/i, "Vi"],
  [/bigbasket|blinkit|zepto|instamart|dmart|reliance\s*fresh|grofers/i, "Groceries"],
  [/starbucks|cafe|coffee/i, "Cafe"],
  [/mcdonald|kfc|domino|pizza|burger/i, "Fast food"],
  [/petrol|hpcl|bpcl|indian\s*oil|iocl|shell/i, "Fuel"],
  [/\batm\b|cash\s*wdl|cash\s*withdrawal/i, "ATM cash"],
  [/\brent\b/i, "Rent"],
  [/\bsip\b|mutual\s*fund|zerodha|groww|upstox|kuvera/i, "Investments"],
  [/\bemi\b|loan/i, "Loan EMI"],
  [/electricity|bescom|tata\s*power|adani\s*elec|msedcl|bses/i, "Electricity"],
  [/pharmacy|apollo|medplus|1mg|pharmeasy|hospital|clinic/i, "Healthcare"],
  [/aws|amazon\s*web|digitalocean|vercel|github|microsoft|azure/i, "Cloud and software"],
];

// Bank short codes that ride along in UPI/IMPS narrations (IFSC prefixes).
const BANK_CODES = new Set([
  "sbin", "hdfc", "icic", "utib", "punb", "kkbk", "idib", "bkid", "cnrb", "ubin", "barb", "yesb", "indb", "fdrl", "ioba",
  "mahb", "cbin", "psib", "ucba", "ibkl", "ratn", "karb", "sibl", "cius", "dlxb", "tmbl", "jaka", "aubm", "paytm", "pytm", "ybl", "okaxis",
  "oksbi", "okhdfcbank", "okicici", "ibl", "axl", "apl",
]);

const DATE_LIKE = /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$|^\d{6,}$/;
const CODE_LIKE = /^(?=.*\d)(?=.*[a-z])[a-z0-9]{2,5}$/i; // P2A, A1, X12: short mixed codes

const isNoise = (t: string) => {
  const lower = t.toLowerCase();
  return NOISE.has(lower) || BANK_CODES.has(lower) || DATE_LIKE.test(t) || CODE_LIKE.test(t) || !/\p{L}/u.test(t) || /^\d+[a-z]{0,2}$/i.test(t);
};

/** A stable, readable label for whoever a transaction went to. */
export function payeeName(raw: string): string {
  const alias = ALIASES.find(([pattern]) => pattern.test(raw));
  if (alias) return alias[1];

  // Narrations are segmented by the rail: "UPI/DR/531/ZOMATO/SBIN/zomato@ybl".
  // The payee is the first segment with real words left after the noise goes.
  const segments = raw
    .replace(/[^\p{L}\p{N}\s/|\-_@.:]/gu, " ")
    .split(/[/|\-_:]+|\s{2,}/)
    .map((segment) =>
      segment
        .split("@")[0] // drop UPI handles
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/^[.\s]+|[.\s]+$/g, ""))
        .filter((t) => t.length > 0 && !isNoise(t))
    )
    .filter((tokens) => tokens.length > 0);

  if (segments.length === 0) return "Other";

  const words = segments[0].slice(0, 3);
  return words.map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase())).join(" ");
}

/** Debits grouped by payee, largest first, with the tail folded into "Other". */
export function groupByPayee(transactions: Transaction[] = [], limit = 8): PayeeSpend[] {
  const groups = new Map<string, PayeeSpend>();
  let total = 0;

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    const isDebit = t.type === "debit" || Number(t.amount) < 0;
    if (!isDebit || amount === 0) continue;

    const name = payeeName(t.name || "");
    const key = name.toLowerCase();
    const group = groups.get(key) ?? { key, name, amount: 0, count: 0, share: 0, transactions: [] };
    group.amount += amount;
    group.count += 1;
    group.transactions.push(t);
    groups.set(key, group);
    total += amount;
  }

  const sorted = [...groups.values()].sort((a, b) => b.amount - a.amount);
  for (const g of sorted) g.share = total ? g.amount / total : 0;

  if (sorted.length <= limit) return sorted;

  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  const other: PayeeSpend = {
    key: "other",
    name: "Other",
    amount: rest.reduce((s, g) => s + g.amount, 0),
    count: rest.reduce((s, g) => s + g.count, 0),
    share: rest.reduce((s, g) => s + g.share, 0),
    transactions: rest.flatMap((g) => g.transactions),
  };
  return [...head, other];
}
