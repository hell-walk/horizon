import "server-only";

import { rechargePicture, type RechargePicture } from "../recharges";
import { ownerAccounts } from "./ownerAccounts";
import { readPrefs } from "./prefs";

/** The plan lengths the person set, by operator, read defensively. */
export async function rechargeDaysFor(ownerId: string): Promise<Record<string, number>> {
  const raw = (await readPrefs(ownerId)).rechargeDays;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [operator, days] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 400 && operator.length <= 40) out[operator] = days;
  }
  return out;
}

/** Every recharge across a person's uploaded accounts, and the currency to show them in. */
export async function rechargesForOwner(ownerId: string): Promise<RechargePicture & { currency: string }> {
  const [accounts, days] = await Promise.all([ownerAccounts(ownerId), rechargeDaysFor(ownerId)]);
  return {
    ...rechargePicture(
      accounts.flatMap((a) => a.transactions),
      days,
    ),
    currency: accounts[0]?.account.currency ?? "INR",
  };
}
