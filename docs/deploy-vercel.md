# Deploying Horizon (Vercel)

Everything here is free to start: Vercel Hobby, Cloudflare DNS, Supabase,
Upstash, Appwrite, Sentry and Brevo free plans. Razorpay charges only a share
of real payments.

**Vercel Hobby is for non-commercial use.** It suits building, testing and a
free beta. Before switching on live payments, move to Vercel Pro or another host.

## What is already set up in the code

- `vercel.json` runs the server in Frankfurt (`fra1`), next to Appwrite.
- Statement files are capped at 4 MB (Vercel accepts at most 4.5 MB per
  request); the browser says so before uploading.
- Vercel runs several copies of the server at once. Rate limits, the trial's
  daily count, the transfer guard and the "usually left over" figure are shared
  through Upstash; each person's bank data is only reused within one request.
- `.github/workflows/keep-awake.yml` keeps the free Supabase and Appwrite
  projects from pausing (see step 6).

## 1. Create the project

1. vercel.com -> sign in with GitHub -> **Add New -> Project** -> import
   `hell-walk/horizon`. Framework: Next.js (found automatically). Branch: `main`.
2. Before the first deploy, open **Environment Variables** and add every
   setting below (Production and Preview). Copy values from your `.env`; type
   them into Vercel, never into chat or a file in the project.

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` (the live address, not localhost) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | a mailbox you really read (shown on Contact, Terms, Privacy, Refunds) |
| `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_CONTACT_PHONE` | as on your Razorpay account (shown on the Contact page) |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT` | as in `.env` |
| `APPWRITE_DATABASE_ID`, `APPWRITE_USER_COLLECTION_ID`, `APPWRITE_BANK_COLLECTION_ID`, `APPWRITE_TRANSACTION_COLLECTION_ID`, `APPWRITE_STATEMENT_COLLECTION_ID`, `APPWRITE_FEEDBACK_COLLECTION_ID` | as in `.env` |
| `NEXT_APPWRITE_KEY` | as in `.env` |
| `APPWRITE_CODES_COLLECTION_ID` | as in `.env` (promo and referral codes; without it, codes cannot be redeemed) |
| `APPWRITE_WEBHOOK_LOG_COLLECTION_ID`, `APPWRITE_TERMS_COLLECTION_ID`, `APPWRITE_SETTINGS_COLLECTION_ID` | as in `.env`, once the admin portal's setup has made these tables; without the first, Razorpay's deliveries are not written down |
| `DATA_ENCRYPTION_KEY` | **exactly** as in `.env`: a different key makes stored bank tokens unreadable |
| `PLAID_*`, `DWOLLA_*`, `SETU_*` | as in `.env` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | as in `.env` |
| `REDIS_PREFIX` | `horizon` (not `horizon-dev`, so the live site's keys are apart) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | as in `.env` (never with a `NEXT_PUBLIC_` name) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | test keys until Razorpay activates your account, then the live ones |
| `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_YEARLY` | from `node scripts/setup-razorpay-plans.mjs --apply` (run again with live keys: live and test plans are separate) |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you type when adding the webhook (step 4) |
| `TRUSTED_PROXY_HOPS` | `1` |
| `SENTRY_AUTH_TOKEN` | optional: from `.env.sentry-build-plugin`, so error reports show readable code |

3. **Deploy**. Vercel builds with `npm run build` (which first builds the
   statement reader's worker).

## 2. Your domain (Hostinger + Cloudflare)

1. In Vercel: project -> **Settings -> Domains** -> add your domain (and `www`).
   Vercel shows the DNS records to create.
2. In Cloudflare -> DNS: create exactly those records with the proxy **off
   (grey cloud, "DNS only")**. Vercel issues the certificate.
3. Wait until Vercel shows the domain as valid.

Without a domain yet, use the `your-project.vercel.app` address everywhere
below and change it later.

## 3. Supabase (sign-in)

- **Authentication -> URL Configuration**: Site URL `https://your-domain`;
  Redirect URLs: `https://your-domain/auth/callback` (and
  `http://localhost:3000/auth/callback` for development).
- **Authentication -> Sign In / Providers -> Email**: *Confirm email* **ON**.
  Sign-ups must click the emailed link before they get an account; this stops
  anyone from signing up with someone else's address.
- **Authentication -> SMTP Settings**: connect a real sender. Supabase's
  built-in one only emails your own team, so confirmation and password-reset
  emails would never reach users. Free: **Brevo** (300 emails a day) or
  **Resend** (100 a day). Sender e.g. `no-reply@your-domain`; add the DNS
  records they give you in Cloudflare.
- Logins moved over from Appwrite have **no password** (passwords cannot be
  copied), so email sign-in says "invalid" for them until they use *Forgot
  password* or you set one: `node scripts/set-login-password.mjs their@email`
  (typed at a hidden prompt; Google sign-in keeps working either way).
- **Authentication -> Rate Limits**: raise *sign-ups and sign-ins* (e.g. 300
  per 5 minutes) and *emails* to what your SMTP plan allows. Every request
  reaches Supabase from Horizon's server, so its per-address limit would apply
  to all users together; Horizon keeps its own per-person limits.
- **Google** (Google Cloud console -> the OAuth client): authorised redirect
  URI is Supabase's callback (shown on the Google provider page in Supabase);
  publish the OAuth consent screen ("In production") so anyone can use it.

## 4. Razorpay (subscriptions)

1. Razorpay checks these pages before activating live payments; they are on
   the site: `/pricing`, `/refunds`, `/contact`, `/terms`, `/privacy`. Set the
   `NEXT_PUBLIC_CONTACT_*` / `BUSINESS_*` settings first.
2. Create the plans: `node scripts/setup-razorpay-plans.mjs --apply` (prices
   come from `src/lib/plans.ts`), put the two ids in Vercel.
3. The webhook. Choose a long random secret, put it in `RAZORPAY_WEBHOOK_SECRET`
   locally and in Vercel (Production and Preview), redeploy, then make the
   webhook through Razorpay's API, with the live address as the site URL:

   ```bash
   NEXT_PUBLIC_SITE_URL=https://your-domain node scripts/setup-razorpay-webhook.mjs --apply
   ```

   Razorpay keeps **separate webhooks for test mode and live mode**, and the
   dashboard only makes the one for the mode it is in (a webhook added there
   in live mode never hears about test subscriptions; that cost two days
   here). The script makes the one matching the keys in `.env`: run it with
   the test keys while testing and again with the live keys after activation.
   Checkout stays disabled until the secret is configured.
4. Changing prices later: edit `src/lib/plans.ts`, run the plans script again
   (Razorpay plans cannot be edited), swap the ids. Existing subscribers keep
   their old price.

## 5. Other services that need the live address

- **Setu** (test mode): redirect URL `https://your-domain/setu/callback`.
- **Sentry**: Settings -> Security & Privacy -> turn on *Prevent Storing of IP
  Addresses* (the privacy policy says Sentry does not keep them).

## 6. Keep the databases awake

Free Supabase and Appwrite projects pause when nothing touches them for a
while. A paused Supabase means nobody can sign in; a paused Appwrite means
nobody sees their accounts (Horizon shows "cannot reach its records" until
you restore the project in the Appwrite console).

GitHub -> the repository -> **Settings -> Secrets and variables -> Actions**:
add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (never the service role key), and
`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT` and `APPWRITE_KEY`. For the key, make a
new one in the Appwrite console (Overview -> Integrations -> API keys) with
only the `databases.read` scope; never reuse the server's key. Then
**Actions -> Keep the databases awake -> Run workflow** once to check it. GitHub
stops scheduled workflows after 60 days without a commit; it emails you first.

## 7. Check it

```bash
node scripts/check-deployment.mjs https://your-domain
```

It checks HTTPS, the security headers, locked pages, the public legal pages,
the webhook, every required setting, Supabase's email confirmation, and that
the Razorpay plans match the prices in the code. All should pass before
inviting users.

## Free-plan limits to know

- **Supabase free**: 50,000 monthly active users; pauses after 7 days idle
  (step 6 prevents it).
- **Upstash free**: 500K commands a month, enough for several hundred active users.
- **Brevo free**: 300 emails a day (sign-up confirmations and password resets).
- **Vercel Hobby**: generous for a beta; non-commercial use only.
