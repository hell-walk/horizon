import { after, NextResponse, type NextRequest } from "next/server";

import { mergeSubscription, readSubscription } from "@/lib/plans";
import { logError } from "@/lib/server/log";
import { saveSubscription } from "@/lib/server/plan";
import { fetchSubscription, toSubscription, webhookIsGenuine } from "@/lib/server/razorpay";
import { createSupabaseAdmin } from "@/lib/server/supabase";
import { recordWebhook, type WebhookOutcome } from "@/lib/server/webhookLog";

// Razorpay tells Horizon when a subscription is paid, renewed, halted or
// cancelled. Only signed messages count, and even then Horizon does not trust
// the message's contents: it asks Razorpay for the subscription itself.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 64 * 1024; // Razorpay's subscription events are a few kilobytes

/**
 * The body as text, read no further than MAX_BODY bytes: a huge request is
 * refused as it arrives, never held in memory whole. Null when too big.
 */
async function boundedBody(request: NextRequest): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: NextRequest) {
  // Each delivery is written down for the admin portal's Payments page, after
  // the answer has gone out: `after` keeps the function alive for that write,
  // where a plain fire-and-forget was cut off the moment Razorpay got its reply.
  const answer = (status: number, entry: { event?: string; subscriptionId?: string; login?: string; outcome: WebhookOutcome; error?: unknown }) => {
    const writeRow = () => recordWebhook({ ...entry, status });
    try {
      after(writeRow);
    } catch {
      void writeRow(); // outside a Next request (the tests call POST directly)
    }
    return NextResponse.json({ ok: status < 400 }, { status });
  };

  const body = await boundedBody(request);
  if (body === null) return answer(413, { outcome: "too-big" });
  if (!webhookIsGenuine(body, request.headers.get("x-razorpay-signature"))) return answer(401, { outcome: "unsigned" });

  let id: string | undefined;
  let name = "";
  try {
    const event = JSON.parse(body) as { event?: string; payload?: { subscription?: { entity?: { id?: string } } } };
    name = event.event ?? "";
    console.log(`razorpay webhook: ${name || "?"} ${event.payload?.subscription?.entity?.id ?? ""}`);
    if (!name.startsWith("subscription.")) return answer(200, { event: name, outcome: "ignored" }); // not ours to act on
    id = event.payload?.subscription?.entity?.id;
  } catch {
    return answer(400, { outcome: "bad-json" });
  }
  if (!id) return answer(200, { event: name, outcome: "ignored" });

  try {
    const latest = await fetchSubscription(id);
    const login = latest.notes?.login ?? "";
    const fresh = await toSubscription(latest);
    if (!UUID.test(login) || !fresh) return answer(200, { event: name, subscriptionId: id, outcome: "ignored", error: "not one Horizon started" });
    const { data } = await createSupabaseAdmin().auth.admin.getUserById(login);
    if (!data.user) return answer(200, { event: name, subscriptionId: id, login, outcome: "ignored", error: "the account was deleted" });
    await saveSubscription(login, mergeSubscription(readSubscription(data.user.app_metadata?.subscription), fresh));
    return answer(200, { event: name, subscriptionId: id, login, outcome: "ok" });
  } catch (error) {
    // A non-2xx answer makes Razorpay try again later.
    logError("razorpay webhook failed", error);
    return answer(500, { event: name, subscriptionId: id, outcome: "failed", error });
  }
}
