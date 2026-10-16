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
  const hasSession = request.cookies.getAll().some((c) => isSessionCookie(c.name));
  // The site's root: Home for people who are signed in, the landing page for
  // everyone else (shown at "/" itself, so the address stays the same).
  if (!hasSession && request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/landing", request.url));
  // Visitors who are not signed in cost nothing: no call to Supabase.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !hasSession) return response;

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

  let signedIn = false;
  try {
    signedIn = Boolean((await supabase.auth.getClaims()).data?.claims);
  } catch {
    // Supabase unreachable: the page treats the visitor as signed out.
  }
  // A cookie left over from an old sign-in is not a session: such a visitor
  // still gets the landing page at the root, not a bounce to sign in.
  if (!signedIn && request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/landing", request.url));
  return renewed;
}

export const config = {
  // Pages and actions only: not built files, images or the Sentry tunnel.
  matcher: ["/((?!_next/static|_next/image|monitoring|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)"],
};
