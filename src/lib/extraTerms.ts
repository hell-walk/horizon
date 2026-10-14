import { termsPattern, type TermGroup } from "./terms";

// The names added from the admin portal, held for the sorting rules
// (categories.ts, spending.ts) to consult. Filled by server/terms.ts at the
// start of a request; empty until then, so everything still works without
// the portal's table (only the built-in names apply).

const patterns: Record<TermGroup, RegExp | null> = { paylater: null, subscription: null };

export function setExtraTerms(terms: Record<TermGroup, string[]>) {
  patterns.paylater = termsPattern(terms.paylater);
  patterns.subscription = termsPattern(terms.subscription);
}

/** Does a bank's description name a lender or pay-later service added from the portal? */
export const extraPayLater = (text: string) => Boolean(patterns.paylater?.test(text));

/** ...or a subscription service added from the portal? */
export const extraSubscription = (text: string) => Boolean(patterns.subscription?.test(text));
