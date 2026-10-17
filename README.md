# Horizon

Every Indian bank account, balance and transaction on one screen. Upload a
statement from any bank (PDF, Excel or CSV, password-protected or not) and
Horizon reads it, checks it with you, and sorts every entry: UPI, cards, EMIs
and pay-later, rent, groceries, subscriptions. On top of that: bills and
subscriptions found in your statements, every charge your banks took (with a
ready request to ask for it back), a cash-flow forecast, savings goals, and
month-by-month history. In eleven Indian languages, light and dark.

Live at **https://www.lazyistudio.in**. 7 days free, then ₹99 a month or ₹999 a year.

## Stack

| Layer | What | Why |
|---|---|---|
| App | Next.js 16 (App Router, server components, server actions), React 19, TypeScript | One codebase for pages and server logic; data stays on the server |
| Styling | Tailwind CSS 4, own design system ("Kinetic Architectural", from Stitch) | Tokens in `src/app/globals.css`, light and dark |
| Sign-in | Supabase Auth (email + password, Google) | Confirmed emails, sessions in an httpOnly cookie |
| Data | Appwrite (database) | Profiles, banks, statement rows, codes, feedback |
| Shared state | Upstash Redis | Rate limits and short-lived locks across server copies |
| Payments | Razorpay Subscriptions | Indian cards and UPI, recurring plans, signed webhooks |
| Errors | Sentry | Error reports, scrubbed of personal data |
| Hosting | Vercel, domain on Cloudflare DNS | |

Built (switched off for now): Plaid (US banks), Setu Account Aggregator (Indian
banks), Dwolla (US transfers).

## Running it

```bash
npm install
cp env.example .env   # then fill it in; every setting is explained there
npm run dev           # http://localhost:3000
```

| Command | Does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run test:security` | Black-box security suite against a running build (see `tests/security/README.md`) |
| `npm run build && npx next start -p 3100` | Production build, as the security suite expects |
| `node scripts/check-deployment.mjs https://www.lazyistudio.in` | Checks a deployment: headers, locked pages, settings, Razorpay plans |
| `node scripts/check-translation.mjs ta` | Checks one language's texts against English |

Deploying: `docs/deploy-vercel.md` walks through every setting and outside service.

## Project structure

Each page lives in its own bracket folder (a route group: the brackets keep it
out of the URL) with the components only it uses. Anything used in two or more
places is in `src/components`.

```
src/
  app/
    (marketing)/landing        / for visitors (the proxy shows it at the root)
    (auth)/                    sign-in, sign-up, welcome, password reset, email links
    (legal)/                   privacy, terms, refunds, pricing, contact
    (root)/                    the signed-in app: Home, My Banks, Account history, Bills,
                               Savings goals, Plans, Connect a bank, Feedback, Privacy and your data
    api/razorpay/webhook       Razorpay's signed notifications
  components/                  shared components (cards, tables, statement import, loaders)
  lib/
    actions/                   server actions: the only functions the browser can call
    server/                    server-only: data access, auth, plans, codes, encryption, rate limits
    statements/                statement parsing (PDF, Excel, CSV) and checks
    providers/                 statement, Plaid and Setu adapters
    i18n/                      languages: messages/<code>/*.json, one folder per language
  proxy.ts                     renews sessions; shows the landing page to visitors at /
scripts/                       setup, admin and check scripts (each explains itself at the top)
tests/unit, tests/security     Vitest suites
```

The admin portal (people, codes, payments, feedback, lists, usage) is a
separate private app: github.com/hell-walk/Admin-Portal.
