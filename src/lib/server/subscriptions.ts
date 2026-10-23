import "server-only";

import { payeeKey } from "../corrections";
import { subscriptionPicture, type Subscription, type SubscriptionPicture } from "../subscriptions";
import { ownerAccounts } from "./ownerAccounts";

/** Every subscription across a person's uploaded accounts (the shared per-request loader does the reading). */
export async function subscriptionsForOwner(ownerId: string): Promise<SubscriptionPicture> {
  const accounts = await ownerAccounts(ownerId);
  const picture = subscriptionPicture(accounts.map((a) => ({ id: a.id, currency: a.account.currency ?? "INR", regular: a.regular })));
  // The bank's words for each, and whether the person has already named it.
  const describe = (s: Subscription): Subscription => {
    const tx = accounts.find((a) => a.id === s.accountId)?.transactions.find((t) => t.id === s.txId);
    return { ...s, payee: tx ? (payeeKey(tx.name) ?? undefined) : undefined, named: !!tx?.shownName };
  };
  return { ...picture, active: picture.active.map(describe), stopped: picture.stopped.map(describe) };
}
