# Phase 5 plan: Supabase login, Redis, subscriptions, admin portal

Decisions so far (11 Oct 2026): Supabase for **login only** (Appwrite keeps the
data), **Upstash** for Redis, **Razorpay** for payments first. AI is not planned.

## 1. Redis (done: `e14776c`)

Rate limits and the transfer double-send guard are shared through Upstash when
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, and fall back
to memory otherwise. Keys are hashed before they leave the server.
Still per instance (fine, short-lived): read caches of bank lists and entries.

## 2. Supabase login (needs the project first)

| Today (Appwrite) | With Supabase |
|---|---|
| `banking-session` cookie holding an Appwrite session | Supabase session cookies via `@supabase/ssr`; a small `proxy.ts` refreshes them |
| `account.create`, `createEmailPasswordSession` | `auth.signUp` / `auth.signInWithPassword` |
| Profile row `userId` = Appwrite user id | Profile row `userId` = Supabase user id |
| Preferences (column layouts, corrections, goals, country) on the Appwrite login | Move into Appwrite, as a `prefs` field on the profile row (one new attribute; a script you run) |
| Password check before deleting the account | `signInWithPassword` on a throwaway client |
| Delete login | `auth.admin.deleteUser` |
| Our own sign-in limits | Kept (now in Redis) |
| No password reset | New "Forgot password" and "Set a new password" pages (Supabase sends the email) |

Existing logins: a script creates each existing person in Supabase and relinks
their profile. They choose a new password through "Forgot password" (password
hashes are not moved). Today these are test accounts, so this is cheap now and
expensive after launch.

Decisions needed:
- **Confirm email on sign-up?** Recommended yes (stops fake sign-ups and typos).
  Supabase's own mail sender is only for testing (a few emails an hour), so it
  needs an email service (Resend or Brevo) connected as SMTP before launch.
- **Region**: Mumbai (closest to users) or Frankfurt (next to Appwrite's data).

## 3. Subscriptions with Razorpay

### What is free and what is paid (your call)
A starting point to discuss, not a decision:
- **Free**: one bank, statement upload, entries and search, month by month, changing names and categories, data download.
- **Pro** (monthly or yearly): unlimited banks, Bills and regular payments, the 30-day forecast, What changed and Your week, savings goals, several currencies, the weekly email.

### How it works
1. `/pricing` page lists the plans (Razorpay's website review expects one).
2. "Upgrade" asks our server to create a Razorpay **subscription** for the plan
   (with a coupon if one was entered) and opens **Razorpay Checkout** with it.
   UPI AutoPay, cards and e-mandates are handled by Razorpay, including the
   RBI rules (auto-debit up to ₹15,000 without an extra approval each time).
3. Checkout returns a signature; the server checks it (HMAC with the key
   secret) and marks the subscription as pending.
4. Razorpay **webhooks** are the source of truth: `subscription.activated`,
   `subscription.charged`, `subscription.pending`, `subscription.halted`,
   `subscription.cancelled`, `subscription.completed`. Each is checked against
   the webhook secret (HMAC of the raw body) and recorded once (event id in
   Redis), then the user's plan is updated.
5. Every paid feature asks one server function, `planOf(user)`, so nothing is
   unlocked by the browser alone.
6. Users can cancel from Settings (at the end of the paid period); the admin
   portal can too.

### Where it is stored
Appwrite collections `subscriptions` (user, plan, Razorpay ids, status, paid
until) and `coupons` (code, kind, value, valid until, uses left). Only the
server key can read them, like the rest.

### Coupons
Two kinds, both created in the admin portal:
- **Free months**: the subscription simply starts later (`start_at`), e.g. "first month free".
- **Percent or amount off**: Razorpay attaches discounts to subscriptions as
  **offers**. If offers can only be made in the Razorpay dashboard, the admin
  portal stores the offer id with the coupon. To check against Razorpay's
  documentation when building.

### Before Razorpay will go live (their website review)
- Pages: Terms, Privacy (have both), **Refund and cancellation**, **Contact us**
  (with a real email and address), **Pricing**.
- KYC: your PAN, bank account, business details (an individual or
  proprietorship can start). GST registration and invoices: ask a CA.
- Test mode works right after sign-up with test keys; build and test there.

## 4. Admin portal (after the above)

- Its own area (`/admin`), only for accounts marked admin in Supabase
  (`app_metadata.role`), with two-step login (Supabase MFA) required.
- **People**: who signed up, last sign-in, plan, country; search by email.
- **Ban / unban**: Supabase can block a login (`ban_duration`) in one place; a
  ban also ends their sessions. Every admin action is written to an audit log.
- **Subscriptions**: see status, cancel, extend.
- **Coupons**: create, pause, see how many were used.
- The admin portal never shows people's bank entries; it is for running the
  service, not reading anyone's money.

## What you need to create (I cannot create accounts)

Put each key in `.env` yourself; never paste them in chat.

1. **Supabase** (supabase.com): a new project. Settings -> API: the project
   URL, the anon (publishable) key and the service role (secret) key ->
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. Authentication -> URL configuration: Site URL
   `http://localhost:3000` for now.
2. **Upstash** (upstash.com): a Redis database in Mumbai or Frankfurt. REST API
   -> `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
3. **Razorpay** (razorpay.com): sign up; Test mode -> API keys ->
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. The webhook secret comes later.
