# Horizon handover

Written on 10 November 2026, the day the developer (Aaditya) left. It says
what is running, how to keep it running, and what is left.

## What is live

- Site: https://www.lazyistudio.in (Vercel, region fra1, deploys from `main`).
- Repository: `hell-walk/horizon` on GitHub, private. `main` and
  `modernize-stack` are kept at the same commit.
- Admin portal: a separate repository, `Admin-Portal`.
- Paying users exist. Razorpay is in live mode.

## Services and what each holds

| Service | Used for | If it stops |
|---|---|---|
| Vercel | hosting, two nightly cron jobs | site down |
| Supabase | logins only | nobody can sign in |
| Appwrite | all data: profiles, banks, statement rows | every page shows "data unavailable" |
| Upstash Redis | rate limits, locks | limits fall back to memory; site keeps working |
| Razorpay | subscriptions | no new payments; existing access continues until it expires |
| Brevo | reminder and report emails | no emails; site unaffected |
| Cloudflare | DNS, email routing, R2 backups | DNS: site down. R2: no new backups |
| Sentry | error reports | nothing visible |

Every setting is named in `env.example`, with comments. Values live in Vercel
(Production) and in the local `.env`, never in the repository.

## Before the developer's access ends (do these first)

1. **Ownership.** Each service above must belong to an account the company
   controls, not a personal login. Check the owner of every one.
2. **`BACKUP_KEY`.** Copy it from Vercel into the company's password manager.
   Without it no backup can ever be opened.
3. **Rotate secrets** the departing developer has seen: Supabase service key,
   Appwrite API key, Razorpay key pair and webhook secret, Brevo key, Upstash
   token, R2 token, `CRON_SECRET`, `DATA_ENCRYPTION_KEY` is the exception: do
   **not** rotate it without a migration, because stored secrets are encrypted
   with it.
4. **Remove the developer** from Vercel, GitHub, Supabase, Appwrite, Razorpay,
   Brevo, Cloudflare, Upstash and Sentry once the above is done.

## Daily operation

Nothing needs doing on a normal day. Two jobs run by themselves:

| Time (IST) | Job | Where to look |
|---|---|---|
| 07:30 | backup to R2 (`/api/cron/backup`) | Vercel → Logs, line starting `[backup]` |
| 09:00 | reminders and, on the 1st, monthly reports (`/api/cron/reminders`) | Vercel → Logs |

Appwrite's free plan pauses an unused project; `.github/workflows/keep-awake.yml`
pings it daily. If every page says data is unavailable, open the Appwrite
console and press Restore.

## Commands

```bash
npm run dev                      # local development
npm test                         # 889 unit tests
npm run test:security:local      # builds, starts a server, 148 attack tests
node scripts/check-deployment.mjs   # checks settings and services
node scripts/scan-secrets.mjs       # scans files and history for secrets
node scripts/restore-backup.mjs list
node scripts/grant-plan.mjs someone@example.com 30 --apply   # free access
```

Before every push: `npm test`, then `npm run test:security:local`.

Restoring data after a loss: `docs/deploy-vercel.md`, section 9.

## Rules the code depends on

- Every server action is a public endpoint. Each one must check the signed-in
  person, limit how often it can be called, and validate its input. A new
  action needs a case in `tests/security/authorization-grid.test.ts`; the
  suite fails without one.
- Everything in `src/lib/finance` is pure (no database, no network). A test
  enforces it.
- All interface text exists in 11 languages. A test fails when a key is
  missing in any of them.
- A database field must exist before code that sorts or filters by it is
  deployed. Create the field, verify it, then push.
- The pre-commit hook scans for secrets. Never skip it.

## What is left

### Open problems

| Item | State | Next step |
|---|---|---|
| A PNB One PDF fails with "could not be read" | Cause unknown. The server now logs the PDF library's own error (deployed with this handover). | Retry the upload, read the Vercel log line starting `[statement: reader crashed`, fix what it names. The file name ended `.pd.pdf`, so a damaged download is likely. |
| First visit after a quiet spell takes 2.7 s | Measured. It is the server starting, not the code. | Vercel → Project → Settings → Functions → enable Fluid Compute. Turn on Speed Insights. |
| 179 statement rows have no stored order | All in test accounts whose balances do not chain. | None needed. |
| October 2026 report email was never sent | The 1 November run sent September's (bug since fixed). | Nothing; the page shows October. The 1 December email will be November's. |

### Not started

- Account Aggregator (automatic bank data). Only the Setu sandbox is wired; it
  serves fake accounts. Real access needs a licensed partner. This is a
  business decision, not a coding task.
- A native mobile app, family sharing, investments and credit score. Rivals
  (Fold, CRED Money, Jupiter, INDmoney) have these.
- Plain-text statement rows: narrations are stored unencrypted in Appwrite.
- A lawyer's review of the terms, privacy and refund pages.

### Housekeeping

- `horizon.code-workspace` is an untracked editor file on the developer's
  machine; keep or delete it.
- On that machine's Desktop: two `.bundle` backups from old history rewrites
  and `keys-moved-out-of-repo`. Delete after confirming nothing is needed.
- The GitHub keep-awake workflow needs five repository secrets
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT`,
  `APPWRITE_KEY`); check its last run is green.

## Where to read more

- `README.md`: stack, running it, project structure.
- `docs/deploy-vercel.md`: every deployment step, including backups.
- `docs/case-studies/`: 10 engineering and 15 UI/UX case studies explaining
  why things are the way they are.
- `docs/rebuild-plan.md`: a 90-day plan for learning the codebase by
  rebuilding it.
- In the `Admin-Portal` repository: `docs/SETUP-AND-USE.md` (set-up and use
  of the admin portal, step by step) and `docs/LEARN-TO-BUILD.md` (a 28-day
  plan for rebuilding the portal).
