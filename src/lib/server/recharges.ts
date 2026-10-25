import "server-only";

import { rechargePicture, type RechargePicture } from "../recharges";
import { ownerAccounts } from "./ownerAccounts";

/** Every recharge across a person's uploaded accounts, and the currency to show them in. */
export async function rechargesForOwner(ownerId: string): Promise<RechargePicture & { currency: string }> {
  const accounts = await ownerAccounts(ownerId);
  return { ...rechargePicture(accounts.flatMap((a) => a.transactions)), currency: accounts[0]?.account.currency ?? "INR" };
}
