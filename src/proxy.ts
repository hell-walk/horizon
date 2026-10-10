import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSessionCookie, safeCookie, SESSION_COOKIE_OPTIONS } from "./lib/sessionCookie";

// Runs before each page request. Its one job: when the sign-in has expired
// (Supabase sessions last an hour and renew themselves), renew it here and
// save the new cookie, because pages themselves cannot write cookies.
// Who may see what is still checked by every page and action, never here.

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  // Visitors who are not signed in cost nothing: no call to Supabase.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !request.cookies.getAll().some((c) => isSessionCookie(c.name))) return response;

  let renewed = response;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        // The page about to render reads the new cookie; the browser keeps it.
        for (const { name, value } of list) request.cookies.set(name, value);
        renewed = NextResponse.next({ request });
        for (const { name, value, options } of list) renewed.cookies.set(name, value, safeCookie(options));
        for (const [key, value] of Object.entries(headers ?? {})) renewed.headers.set(key, value);
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    // Supabase unreachable: the page treats the visitor as signed out.
  }
  return renewed;
}

export const config = {
  // Pages and actions only: not built files, images or the Sentry tunnel.
  matcher: ["/((?!_next/static|_next/image|monitoring|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)"],
};
