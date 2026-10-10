import { payeeWords } from "./payees";

// Changes a user makes to how a transaction is shown: a clearer name, a
// different category. They never touch the bank's own record. A change is
// either for one entry, or for everyone with the same payee ("always call
// UPI/DR/531/RAHUL SHARMA 'Rent', category Rent"), so the next statement
// from the same bank comes in already sorted the way the user likes.

/** The categories a user can choose. English names are data; the screen translates them. */
export const CATEGORIES = [
  "Food",
  "Groceries",
  "Shopping",
  "Bills & recharges",
  "Subscriptions",
  "Rent",
  "Travel",
  "Health",
  "EMI & pay later",
  "Investments",
  "Cash (ATM)",
  "UPI payments",
  "Bank transfer",
  "Card",
  "Income",
  "Between my accounts",
  "Other",
] as const;

/** Money moved between the user's own accounts: not spending, so charts leave it out. */
export const OWN_TRANSFER = "Between my accounts";

export const MAX_NAME_LENGTH = 60;
export const MAX_PAYEE_RULES = 150;
export const MAX_ROW_CHANGES = 150;

export type Correction = { name?: string; category?: string };
export type Corrections = { payees: Record<string, Correction>; rows: Record<string, Correction> };

export const isCategory = (value: unknown): value is (typeof CATEGORIES)[number] => typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);

/**
 * The key a payee-wide change is stored under: the payee's own words, lower
 * case. Not the alias ("Investments" covers many companies), so renaming one
 * payee never renames others. Null when the text has no readable payee.
 */
export const payeeKey = (raw: string): string | null => {
  const words = payeeWords(raw || "");
  return words === "Other" ? null : words.toLowerCase();
};

/** A name the user typed, made safe to store and show; null when nothing usable is left. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ") // control and invisible characters
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || null;
}

const readOne = (value: unknown): Correction | null => {
  if (!value || typeof value !== "object") return null;
  const { name, category } = value as Record<string, unknown>;
  const out: Correction = {};
  const cleaned = cleanName(name);
  if (cleaned) out.name = cleaned;
  if (isCategory(category)) out.category = category;
  return out.name || out.category ? out : null;
};

const readMap = (value: unknown, max: number): Record<string, Correction> => {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, Correction> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, max)) {
    const one = readOne(entry);
    if (one && key.length <= 200) out[key] = one;
  }
  return out;
};

/** Reads stored corrections defensively: anything malformed is dropped, never trusted. */
export function readCorrections(value: unknown): Corrections {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { payees: readMap(v.payees, MAX_PAYEE_RULES), rows: readMap(v.rows, MAX_ROW_CHANGES) };
}

/**
 * The transactions with the user's changes applied. A change to one entry
 * wins over a change for the whole payee. The bank's text stays in `name`.
 */
export function applyCorrections<T extends Pick<Transaction, "id" | "name">>(transactions: T[], corrections: Corrections): (T & Pick<Transaction, "shownName" | "userCategory" | "changedBy">)[] {
  const hasPayees = Object.keys(corrections.payees).length > 0;
  const hasRows = Object.keys(corrections.rows).length > 0;
  if (!hasPayees && !hasRows) return transactions;

  return transactions.map((tx) => {
    const row = hasRows ? corrections.rows[tx.id] : undefined;
    const key = hasPayees ? payeeKey(tx.name) : null;
    const payee = key ? corrections.payees[key] : undefined;
    if (!row && !payee) return tx;
    const name = row?.name ?? payee?.name;
    const category = row?.category ?? payee?.category;
    return {
      ...tx,
      ...(name ? { shownName: name } : {}),
      ...(category ? { userCategory: category } : {}),
      changedBy: row ? "row" : "payee",
    };
  });
}
