import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runBackup } from "@/lib/server/backup";
import { logError } from "@/lib/server/log";
import { isR2Configured } from "@/lib/server/r2";

// The nightly backup to R2. Vercel Cron calls it (vercel.json) with
// "Authorization: Bearer <CRON_SECRET>"; anyone else is refused. Until R2 is
// configured it says so and does nothing, so the cron never fails silently.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  if (!isR2Configured()) return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  try {
    const stats = await runBackup();
    console.log(`[backup] ${stats.key}: ${stats.documents} rows in ${stats.collections} tables, ${stats.logins} logins, ${stats.bytes} bytes; pruned ${stats.pruned.length}`);
    return NextResponse.json(stats);
  } catch (error) {
    logError("cron: backup failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
