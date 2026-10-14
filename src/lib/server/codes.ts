import "server-only";

import { createHmac } from "node:crypto";
import { ID, Query } from "node-appwrite";

import { planFrom, readSubscription, REFERRAL_FREE_DAYS, type Subscription } from "../plans";
import type { SessionUser } from "./auth";
import { createAdminClient } from "./appwrite";
import { saveSubscription } from "./plan";
import { createSupabaseAdmin } from "./supabase";

// Promo codes (made by the team, for anyone) and referral codes (one per
// person). Redeeming one gives free days: a "comp" subscription that does not
// renew, or more days on one already there. Paid subscribers are not touched:
// Razorpay bills on its own schedule, so free days would mean nothing to them.
// A login can redeem one code, ever (kept on the login, which only the server
// writes); a referral also gives the referrer the same free days.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_CODES_COLLECTION_ID: CODES } = process.env;
const DAY = 86_400_000;

export type Code = {
  id: string;
  code: string;
  kind: "promo" | "referral";
  ownerId: string;
  freeDays: number;
  maxUses: number;
  uses: number;
  expiresAt: string;
  active: boolean;
};

const fromRow = (row: Record<string, unknown> & { $id: string }): Code => ({
  id: row.$id,
  code: String(row.code),
  kind: row.kind === "referral" ? "referral" : "promo",
  ownerId: String(row.ownerId ?? ""),
  freeDays: Number(row.freeDays) || 0,
  maxUses: Number(row.maxUses) || 0,
  uses: Number(row.uses) || 0,
  expiresAt: String(row.expiresAt ?? ""),
  active: row.active !== false,
});

/** Codes are typed by people: upper case, no spaces or dashes to get wrong. */
export const normalizeCode = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);

export const isCodesConfigured = () => Boolean(DATABASE_ID && CODES);

export async function findCode(code: string): Promise<Code | null> {
  if (!isCodesConfigured()) return null;
  const { database } = await createAdminClient();
  const found = await database.listDocuments(DATABASE_ID!, CODES!, [Query.equal("code", [code]), Query.limit(1)]);
  return found.documents[0] ? fromRow(found.documents[0] as never) : null;
}

/**
 * A person's own referral code: the same every time (made from their login id
 * with the server's key, so nobody can work out anyone else's), stored on
 * first sight so a redemption can find whose it is.
 */
export async function myReferralCode(session: SessionUser): Promise<string | null> {
  if (!isCodesConfigured()) return null;
  const digest = createHmac("sha256", process.env.DATA_ENCRYPTION_KEY ?? "horizon")
    .update(`referral:${session.id}`)
    .digest("base64url")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const code = `HZ${digest.slice(0, 6)}`;
  const { database } = await createAdminClient();
  const existing = await database.listDocuments(DATABASE_ID!, CODES!, [Query.equal("code", [code]), Query.limit(1)]);
  if (existing.total === 0) {
    await database.createDocument(DATABASE_ID!, CODES!, ID.unique(), {
      code,
      kind: "referral",
      ownerId: session.id,
      freeDays: REFERRAL_FREE_DAYS,
      maxUses: 0,
      uses: 0,
      expiresAt: "",
      active: true,
    });
  }
  return code;
}

export type RedeemOutcome =
  { ok: true; freeDays: number; until: number } | { ok: false; reason: "unknown" | "expired" | "used-up" | "own" | "already" | "subscribed" | "not-ready" };

/** Free days for one login: a comp subscription, or more days on the one there. Returns the new paid-up date. */
export async function grantFreeDays(login: { id: string; joinedAt: number; subscription: Subscription | null }, freeDays: number): Promise<number> {
  const now = Date.now();
  const plan = planFrom({ joinedAt: login.joinedAt, subscription: login.subscription, usedToday: 0 });
  // Count from the end of what they already have (trial or comp), never from the past.
  const from = Math.max(now, plan.kind === "trial" ? plan.endsAt : 0, login.subscription?.until ?? 0);
  const until = from + freeDays * DAY;
  const id = login.subscription?.id.startsWith("comp_") ? login.subscription.id : `comp_${now}`;
  await saveSubscription(login.id, { id, period: "monthly", status: "cancelled", until });
  return until;
}

/** Redeems a code for the signed-in person. Every rule lives here; the action only checks the session. */
export async function redeemCode(session: SessionUser, raw: string): Promise<RedeemOutcome> {
  if (!isCodesConfigured()) return { ok: false, reason: "not-ready" };
  const code = normalizeCode(raw);
  if (code.length < 4) return { ok: false, reason: "unknown" };

  const admin = createSupabaseAdmin();
  const { data } = await admin.auth.admin.getUserById(session.id);
  if (!data.user) return { ok: false, reason: "unknown" };
  if (data.user.app_metadata?.redeemed_code) return { ok: false, reason: "already" };
  const current = readSubscription(data.user.app_metadata?.subscription);
  const plan = planFrom({ joinedAt: session.joinedAt, subscription: current, usedToday: 0 });
  if (plan.kind === "subscribed" && !current?.id.startsWith("comp_")) return { ok: false, reason: "subscribed" };

  const found = await findCode(code);
  if (!found || !found.active) return { ok: false, reason: "unknown" };
  if (found.expiresAt && Date.parse(found.expiresAt) < Date.now()) return { ok: false, reason: "expired" };
  if (found.maxUses > 0 && found.uses >= found.maxUses) return { ok: false, reason: "used-up" };
  if (found.kind === "referral" && found.ownerId === session.id) return { ok: false, reason: "own" };

  // Count the use first: two tabs redeeming at once must not both get in under the cap.
  const { database } = await createAdminClient();
  await database.updateDocument(DATABASE_ID!, CODES!, found.id, { uses: found.uses + 1 });
  const until = await grantFreeDays({ id: session.id, joinedAt: session.joinedAt, subscription: current }, found.freeDays);
  // Remembered on the login, next to the subscription (saveSubscription keeps other app_metadata keys).
  await admin.auth.admin.updateUserById(session.id, { app_metadata: { redeemed_code: code } });

  if (found.kind === "referral" && found.ownerId) {
    // The referrer gets the same, unless they pay already (Razorpay bills them on its own schedule).
    const owner = await admin.auth.admin.getUserById(found.ownerId);
    if (owner.data.user) {
      const theirs = readSubscription(owner.data.user.app_metadata?.subscription);
      const theirPlan = planFrom({ joinedAt: Date.parse(owner.data.user.created_at ?? "") || Date.now(), subscription: theirs, usedToday: 0 });
      if (theirPlan.kind !== "subscribed" || theirs?.id.startsWith("comp_")) {
        await grantFreeDays({ id: found.ownerId, joinedAt: Date.parse(owner.data.user.created_at ?? "") || Date.now(), subscription: theirs }, found.freeDays);
      }
    }
  }
  return { ok: true, freeDays: found.freeDays, until };
}
