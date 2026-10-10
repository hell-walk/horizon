# Horizon security test report

**Date:** 10 October 2026 · **Branch:** `modernize-stack` · **Target:** a local production build (`next build` + `next start`), two throwaway test accounts. No deployed site, real user or live payment was touched.

## Results

| Suite | Command | Result |
|---|---|---|
| Unit and integration (Vitest) | `npm test` | **233 / 233 pass** · 71% statement coverage of `src/lib` |
| Security, black-box | `npm run test:security` | **71 / 71 pass** |

The security suite attacks the running app the way an outsider would: raw HTTP, server actions called by id with no UI, forged headers and cookies, hostile files, a second account going after the first one's data, and direct calls to Appwrite with a user's own session. See `tests/security/README.md` to run it.

## Found and fixed during testing

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | `createAdminClient` and `createSessionClient` were public server actions (`src/lib/server/appwrite.ts` started with `"use server"`). Anyone, signed out, could make the server build the admin Appwrite client. The API key did not leak only because React refuses to serialise class instances. | The file is server-only; the build now exposes exactly 11 intended actions, and a unit test fails if `"use server"` appears outside `src/lib/actions`. |
| 2 | Medium | Statement uploads over 1 MB failed (Next's default server-action body limit), although the page promised 10 MB. | `serverActions.bodySizeLimit: "11mb"`. A 2 MB statement now imports; a 12 MB body is cut off without harming the server. |
| 3 | Medium | The sign-in limit counted successful sign-ins, so a user signing in on several devices could be locked out. | Only wrong passwords count (8 per email per 10 minutes). |
| 4 | Medium | Sign-up shared the generous per-IP sign-in limit (100 / 10 min), while each sign-up creates real accounts. | Separate cap: 10 sign-ups per IP per hour. |
| 5 | Low | `getLoggedInUser` was a public action (returned only the caller's own, already sanitised user). | Moved to `src/lib/server/auth.ts`; no longer an endpoint. |
| 6 | Low | The column-mapping validator read inherited (prototype) properties. Not reachable through `JSON.parse`, but relied on that. | Own keys only, and the action passes on a clean copy (`cleanMapping`). |
| 7 | Low | `src/lib/server/selectedAccount.ts` was not marked server-only. | Marked; covered by the structure test. |
| 8 | Low | `signIn`/`signUp` called with a non-object crashed with a TypeError (no data leaked, the client saw only a digest). | Both check the input shape and length first. |

## What held up

- **Other people's data.** Account A cannot see B's transactions through `?id=`, the selected-account cookie, or any page; cannot restyle B's card; cannot send money from B's account; cannot file a statement under B by naming B in the form. B still sees their own data (the tests are not vacuous).
- **Appwrite directly.** With A's own session, listing or writing any of the four collections returns 401. A user can edit their own account preferences, but a poisoned saved column layout is ignored by the server.
- **Script injection.** HTML in a statement narration is stored as text and rendered escaped; it never reaches the page as live markup.
- **Hostile files.** A zip bomb (60 MB unpacked from about 60 KB) is refused in milliseconds without unpacking; a 250-page PDF and a 50,000+ row file are refused; the server stays responsive.
- **Sessions.** The cookie is HttpOnly, SameSite=Strict, Secure, and expires within 30 days. Logging out revokes the session on the server: replaying the old cookie lands on sign-in.
- **Brute force.** An email locks after 8 wrong passwords even when the attacker rotates `X-Forwarded-For`; a wrong password and a missing account get the same answer.
- **Signed-out access.** Every signed-in page redirects to sign-in, also with forged or oversized cookies; every action refuses without a session; unknown action ids are refused.
- **Cross-site requests.** A server action posted with another site's `Origin` is rejected.
- **Leaks.** Malformed and oversized requests return no stack traces or paths; `.env`, `.git`, `package.json`, the action manifest and client source maps are not served; the Sentry tunnel does not relay to other Sentry projects.
- **Headers.** HSTS, nosniff, `X-Frame-Options: DENY`, referrer and permissions policies, and a CSP with no `unsafe-eval` and `object-src 'none'` in production; no `X-Powered-By`.

## Known limits (accepted or for later)

| Area | Detail | Recommendation |
|---|---|---|
| Rate limits are in memory | Per server instance; reset on restart; weak on serverless hosts with many instances. | Run as one long-lived instance, or move counters to Upstash Redis. |
| Account lockout | Anyone who knows an email can lock its sign-in for 10 minutes with 8 wrong passwords. | Accepted trade-off for now; a password-reset flow or per-IP lockout keys would soften it. |
| Proxy headers | Origin checking and client IPs rely on `X-Forwarded-Host` / `X-Forwarded-For` set by a trusted proxy. Locally a client can send its own. | Deploy behind a proxy that overwrites both (Vercel, Netlify, Render and nginx do); set `TRUSTED_PROXY_HOPS`. |
| CSP allows inline scripts | Needed by Next.js without per-request nonces. | Nonce-based CSP when it is worth making every page dynamic. |
| Old rows | Bank tokens stored before encryption, and SSN/date of birth from sign-ups before 10 Oct 2026, are still in Appwrite. | One-time migration (waiting on approval). |
| Not tested | Real Plaid/Dwolla transfers end to end; Setu with a live consent; load beyond a single user. | Sandbox end-to-end run before launch. |

## Test data left behind

Account A gained a few test banks ("XSS Test Bank", "Planted Test Bank", and a "Victim Test Bank" of its own from an early run); account B has "Victim Test Bank". Both accounts are throwaway test accounts.
