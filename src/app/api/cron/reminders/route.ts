import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { logError } from "@/lib/server/log";
import { runReminders } from "@/lib/server/notify";

// The daily reminder run. Vercel Cron calls it (vercel.json) with
// "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const stats = await runReminders();
    return NextResponse.json(stats ?? { skipped: "already ran today" });
  } catch (error) {
    logError("cron: reminders failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
