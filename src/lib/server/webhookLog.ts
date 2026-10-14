import "server-only";

import { ID } from "node-appwrite";

import { createAdminClient } from "./appwrite";
import { describeError, logError } from "./log";

// One row per message Razorpay sends to the webhook, for the admin portal's
// Payments page (deliveries and failures). Best effort: writing the row never
// changes the answer Razorpay gets. Nothing from the message body is kept
// except the event name and the subscription id.

const { APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_WEBHOOK_LOG_COLLECTION_ID: LOG } = process.env;

export type WebhookOutcome = "ok" | "ignored" | "failed" | "unsigned" | "too-big" | "bad-json";

export async function recordWebhook(entry: { event?: string; subscriptionId?: string; login?: string; outcome: WebhookOutcome; status: number; error?: unknown }) {
  if (!DATABASE_ID || !LOG) return;
  try {
    const { database } = await createAdminClient();
    await database.createDocument(DATABASE_ID, LOG, ID.unique(), {
      event: (entry.event ?? "").slice(0, 64),
      subscriptionId: (entry.subscriptionId ?? "").slice(0, 64),
      login: (entry.login ?? "").slice(0, 64),
      outcome: entry.outcome,
      error: entry.error === undefined ? "" : describeError(entry.error).slice(0, 500),
      status: entry.status,
    });
  } catch (error) {
    logError("webhook log: could not write the row", error);
  }
}
