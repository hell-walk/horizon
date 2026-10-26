// Names the team adds from the admin portal without a code change: lenders and
// pay-later services (grouped as "EMI & pay later") and subscription services.
// The built-in lists stay in categories.ts and spending.ts; these match on
// top. The same matcher lives in the admin portal (Admin-Portal/src/lib/terms.ts),
// so what the portal shows as a match is what Horizon does. Keep the two identical.

export type TermGroup = "paylater" | "subscription";

/** How a typed name is kept: trimmed, single spaces, letters, digits, & and spaces only. */
export const normalizeTerm = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One pattern for a list of names: each as a whole word, any case, spaces
 * optional ("lazy pay" matches "LAZYPAY@" and "Lazy Pay"). Null for no names.
 */
export function termsPattern(terms: string[]): RegExp | null {
  const parts = terms
    .map(normalizeTerm)
    .filter((t) => t.length >= 3)
    .map((t) => t.split(" ").map(escape).join("\\s*"));
  if (parts.length === 0) return null;
  return new RegExp(`(?<![a-z0-9])(?:${parts.join("|")})(?![a-z0-9])`, "i");
}

/** Which of the names a bank's description contains. */
export function matchingTerms(description: string, terms: string[]): string[] {
  return terms.filter((t) => termsPattern([t])?.test(description));
}
