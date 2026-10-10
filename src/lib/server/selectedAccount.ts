import "server-only";

import { cookies } from "next/headers";

import { resolveAccountId, SELECTED_ACCOUNT_COOKIE } from "../selectedAccount";

/** Server side: the active account for this request (explicit ?id, then the remembered one, then the first). */
export async function activeAccountId(accounts: Account[], requested?: string | string[]) {
  const remembered = (await cookies()).get(SELECTED_ACCOUNT_COOKIE)?.value;
  return resolveAccountId(accounts, requested, remembered ? decodeURIComponent(remembered) : undefined);
}
