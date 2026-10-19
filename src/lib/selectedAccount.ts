// The account the whole app is looking at. Swapping the card on Home (or picking
// an account anywhere else) remembers it here, so every page opens on the same
// account until another one is chosen.

export const SELECTED_ACCOUNT_COOKIE = "horizon-account";

/** Client side: remember the active account for a year. */
export function rememberAccount(appwriteItemId: string | undefined) {
  if (!appwriteItemId || typeof document === "undefined") return;
  document.cookie = `${SELECTED_ACCOUNT_COOKIE}=${encodeURIComponent(appwriteItemId)}; path=/; max-age=31536000; samesite=lax`;
}

// Pages that show one account and take ?id= for it. The rest show every account
// (bills, charges, loans) or read only the remembered one (My banks).
const ACCOUNT_PAGES = ["/", "/transaction-history", "/payment-transfer", "/goals", "/spending"];

/** True when the page at this path follows ?id=: switching accounts there means a new address, elsewhere a refresh. */
export const pageFollowsAccount = (pathname: string) => ACCOUNT_PAGES.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));

/**
 * Picks the active account: an explicit ?id on the page wins, then the
 * remembered one, then the first account. Ids that no longer belong to the
 * user are ignored.
 */
export function resolveAccountId(accounts: Account[], requested?: string | string[], remembered?: string) {
  const ids = new Set(accounts.map((a) => a.appwriteItemId));
  const asked = typeof requested === "string" ? requested : undefined;
  if (asked && ids.has(asked)) return asked;
  if (remembered && ids.has(remembered)) return remembered;
  return accounts[0]?.appwriteItemId;
}
