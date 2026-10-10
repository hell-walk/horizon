import { NextResponse, type NextRequest } from "next/server";

import { logError } from "@/lib/server/log";
import { createSupabaseServerClient } from "@/lib/server/supabase";

// Where Supabase sends people back to: after "Continue with Google", and from
// a "set a new password" email. The one-time code becomes the session cookie.

// Only these pages, so the link cannot send anyone to another site.
const NEXT_PAGES = new Set(["/", "/reset-password"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = NEXT_PAGES.has(params.get("next") ?? "") ? params.get("next")! : "/";
  const code = params.get("code");
  const tokenHash = params.get("token_hash");

  let ok = false;
  try {
    const supabase = await createSupabaseServerClient();
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && params.get("type") === "recovery") {
      // The email template's link form, which works on any device.
      ok = !(await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error;
    }
  } catch (error) {
    logError("auth callback failed", error);
  }

  // The home page sends a new Google user on to /welcome to finish setting up.
  const to = ok ? next : next === "/reset-password" ? "/forgot-password?expired=1" : "/sign-in?failed=1";
  const response = NextResponse.redirect(new URL(to, request.nextUrl.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
