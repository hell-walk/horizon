import { NextResponse, type NextRequest } from "next/server";

import { unsubscribeEmail } from "@/lib/actions/notify.action";

// One-click unsubscribe (RFC 8058): mail apps POST to the address in the
// List-Unsubscribe header. The link's own signature is the permission; a
// plain visit (GET) goes to the page with a button instead, so an email
// scanner opening links cannot turn anyone's reminders off.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const result = await unsubscribeEmail({ u: url.searchParams.get("u"), t: url.searchParams.get("t") });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
