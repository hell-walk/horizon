# Deploying Horizon for free (Vercel Hobby)

Everything here is free: Vercel Hobby, Cloudflare DNS, Supabase, Upstash,
Appwrite and Sentry free plans. Razorpay charges only a share of real payments.

**Vercel Hobby is for non-commercial use.** It suits building, testing and a
free beta. Before switching on real (live) payments, move to Vercel Pro or to
another host.

## What is already set up in the code

- `vercel.json` runs the server in Frankfurt (`fra1`), next to Appwrite.
- Statement files are capped at 4 MB (Vercel accepts at most 4.5 MB per
  request); the browser says so before uploading.
- Vercel runs several copies of the server at once. Rate limits, the transfer
  guard and the "usually left over" figure are shared through Upstash; each
  person's bank data is only reused within one request, so no copy shows old
  data after a change.

## 1. Create the project

1. vercel.com -> sign in with GitHub -> **Add New -> Project** -> import
   `hell-walk/horizon`. Framework: Next.js (found automatically). Branch: `main`.
2. Before the first deploy, open **Environment Variables** and add every
   setting below (Production and Preview). Copy values from your `.env`; type
   them into Vercel, never into chat or a file in the project.

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT` | as in `.env` |
| `APPWRITE_DATABASE_ID`, `APPWRITE_USER_COLLECTION_ID`, `APPWRITE_BANK_COLLECTION_ID`, `APPWRITE_TRANSACTION_COLLECTION_ID`, `APPWRITE_STATEMENT_COLLECTION_ID` | as in `.env` |
| `NEXT_APPWRITE_KEY` | as in `.env` |
| `DATA_ENCRYPTION_KEY` | **exactly** as in `.env`: a different key makes stored bank tokens unreadable |
| `PLAID_*`, `DWOLLA_*`, `SETU_*` | as in `.env` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | as in `.env` |
| `REDIS_PREFIX` | `horizon` (not `horizon-dev`, so the live site's keys are apart) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | as in `.env` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | the test keys for now |
| `TRUSTED_PROXY_HOPS` | `1` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` (the live address, not localhost) |
| `SENTRY_AUTH_TOKEN` | optional: from `.env.sentry-build-plugin`, so error reports show readable code. The Sentry DSN is already in the code. |

3. **Deploy**. Vercel builds with `npm run build` (which first builds the
   statement reader's worker).

## 2. Your domain (Hostinger + Cloudflare)

1. In Vercel: project -> **Settings -> Domains** -> add your domain (and `www`).
   Vercel shows the DNS records to create.
2. In Cloudflare -> DNS: create exactly those records (usually an `A` record
   for the bare domain and a `CNAME` for `www`), with the proxy **off (grey
   cloud, "DNS only")**. Vercel issues the certificate and protects the site;
   Cloudflare's proxy in front of Vercel causes problems.
3. Wait until Vercel shows the domain as valid.

## 3. Protection on Vercel

- Project -> **Firewall**: keep the default protection on. If someone floods
  the site, switch on **Attack Challenge Mode** for the duration.
- If your plan offers rate-limit rules, add one: `POST` to `/sign-in` or
  `/sign-up`, about 10 requests per 10 seconds per IP. Horizon's own limits
  (in Upstash) apply either way.

## 4. Services that need the live address

- **Supabase** -> Authentication -> URL configuration: Site URL
  `https://your-domain`, and add it to Redirect URLs.
- **Setu** (test mode): redirect URL `https://your-domain/setu/callback`.
- **Razorpay** (when we add webhooks): webhook URL on your domain.

## 5. Check it

```bash
node scripts/check-deployment.mjs https://your-domain
```

All checks should pass, including HTTPS and the security headers.

## Free-plan limits to know

- **Supabase free** projects pause after 7 days without activity (sign-in
  stops until you unpause). A weekly automatic visit will keep it awake once
  sign-in runs on Supabase.
- **Upstash free**: 500K commands a month, enough for several hundred active
  users.
- **Vercel Hobby**: generous for a beta; non-commercial use only.
