import { NextResponse, type NextRequest } from "next/server";

import { mergeSubscription, readSubscription } from "@/lib/plans";
import { logError } from "@/lib/server/log";
import { saveSubscription } from "@/lib/server/plan";
import { fetchSubscription, toSubscription, webhookIsGenuine } from "@/lib/server/razorpay";
import { createSupabaseAdmin } from "@/lib/server/supabase";

// Razorpay tells Horizon when a subscription is paid, renewed, halted or
// cancelled. Only signed messages count, and even then Horizon does not trust
// the message's contents: it asks Razorpay for the subscription itself.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 64 * 1024;

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (body.length > MAX_BODY || !webhookIsGenuine(body, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let id: string | undefined;
  try {
    const event = JSON.parse(body) as { event?: string; payload?: { subscription?: { entity?: { id?: string } } } };
    if (!event.event?.startsWith("subscription.")) return NextResponse.json({ ok: true }); // not ours to act on
    id = event.payload?.subscription?.entity?.id;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!id) return NextResponse.json({ ok: true });

  try {
    const latest = await fetchSubscription(id);
    const login = latest.notes?.login ?? "";
    const fresh = toSubscription(latest);
    if (!UUID.test(login) || !fresh) return NextResponse.json({ ok: true }); // not one Horizon started
    const { data } = await createSupabaseAdmin().auth.admin.getUserById(login);
    if (!data.user) return NextResponse.json({ ok: true }); // the account was deleted
    await saveSubscription(login, mergeSubscription(readSubscription(data.user.app_metadata?.subscription), fresh));
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A non-2xx answer makes Razorpay try again later.
    logError("razorpay webhook failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
