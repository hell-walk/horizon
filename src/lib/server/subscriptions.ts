import "server-only";

import { subscriptionPicture, type SubscriptionPicture } from "../subscriptions";
import { ownerAccounts } from "./ownerAccounts";

/** Every subscription across a person's uploaded accounts (the shared per-request loader does the reading). */
export async function subscriptionsForOwner(ownerId: string): Promise<SubscriptionPicture> {
  const accounts = await ownerAccounts(ownerId);
  return subscriptionPicture(accounts.map((a) => ({ currency: a.account.currency ?? "INR", regular: a.regular })));
}
