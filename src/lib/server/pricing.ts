import "server-only";

import { Query } from "node-appwrite";

import { cached } from "../cache";
import { PRICES, type Period } from "../plans";
import { createAdminClient } from "./appwrite";
import { logError } from "./log";

// What Horizon charges, and which Razorpay plan charges it. Set from the admin
// portal (Appwrite "settings" table, key "pricing"); until it has been set, the
// numbers in plans.ts and the plan ids in .env apply, as before. Razorpay plans
// cannot be edited, so every price change is a new plan: the history keeps
// every plan id ever used, so an older subscription still maps to its period.

export type PlanPrice = { amount: number; planId: string };
export type Pricing = {
  monthly: PlanPrice;
  yearly: PlanPrice;
  history: { period: Period; amount: number; planId: string }[];
  /** True when the portal set it (as opposed to plans.ts and .env). */
  fromPortal: boolean;
};

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_SETTINGS_COLLECTION_ID: SETTINGS } = process.env;
const EVERY = 5 * 60_000;

const fallback = (): Pricing => ({
  monthly: { amount: PRICES.monthly.amount, planId: process.env.RAZORPAY_PLAN_MONTHLY ?? "" },
  yearly: { amount: PRICES.yearly.amount, planId: process.env.RAZORPAY_PLAN_YEARLY ?? "" },
  history: [],
  fromPortal: false,
});

async function fetchPricing(): Promise<Pricing> {
  const { database } = await createAdminClient();
  const found = await database.listDocuments(DATABASE_ID!, SETTINGS!, [Query.equal("key", ["pricing"]), Query.limit(1)]);
  const row = found.documents[0] as unknown as { value?: string } | undefined;
  if (!row?.value) return fallback();
  const stored = JSON.parse(row.value) as Partial<Pricing>;
  const ok = (p: unknown): p is PlanPrice => Boolean(p && typeof p === "object" && typeof (p as PlanPrice).amount === "number" && typeof (p as PlanPrice).planId === "string");
  if (!ok(stored.monthly) || !ok(stored.yearly)) return fallback();
  return { monthly: stored.monthly, yearly: stored.yearly, history: Array.isArray(stored.history) ? stored.history : [], fromPortal: true };
}

/** The current prices and plan ids (cached a few minutes). Never throws. */
export async function currentPricing(): Promise<Pricing> {
  if (!DATABASE_ID || !SETTINGS) return fallback();
  try {
    return await cached("pricing", EVERY, fetchPricing);
  } catch (error) {
    logError("pricing: could not read the settings table; using plans.ts", error);
    return fallback();
  }
}

/** The period a Razorpay plan id belongs to: today's plans, any older one from the history, or the .env ids. */
export async function periodOfPlan(planId: string): Promise<Period | null> {
  const pricing = await currentPricing();
  if (planId === pricing.monthly.planId) return "monthly";
  if (planId === pricing.yearly.planId) return "yearly";
  const old = pricing.history.find((h) => h.planId === planId);
  if (old) return old.period;
  if (planId && planId === process.env.RAZORPAY_PLAN_MONTHLY) return "monthly";
  if (planId && planId === process.env.RAZORPAY_PLAN_YEARLY) return "yearly";
  return null;
}
