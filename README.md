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

Two rules decide where a file goes:

1. **A page owns what only it uses.** Each page is a bracket folder (a route
   group: the brackets keep it out of the URL). Its page file sits there, and
   every component only that page uses sits in its `components/` (or `ui/`).
   Next.js's own files (`page`, `layout`, `loading`, `route`...) are the only
   files beside a page.
2. **What two or more places use is shared, and shared code is sorted by what
   it is**, never left loose: components by their role in `src/components/*`,
   logic by its kind in `src/lib/*`.

`tests/unit/structure.test.ts` checks both rules (and that pages never reach
into each other, that `lib/finance` stays free of I/O, that server code says
so), so the layout cannot drift. File names are camelCase (`bankCard.tsx`).

```
src/
  app/                         pages, one bracket folder each
    (marketing)/landing          / for visitors (the proxy shows it at the root)
    (auth)/                      sign-in, sign-up, welcome, password reset, email links
    (legal)/                     privacy, terms, refunds, pricing, contact, support
    (root)/                      the signed-in app: the shell (layout, components/: top bar,
                                 menus, guided tour) and a bracket folder per page:
      (home)/ (my-banks)/ (transaction-history)/ (spending)/ (bills)/ (calendar)/
      (loans)/ (charges)/ (report)/ (checks)/ (goals)/ (plans)/ (connect-bank)/ ...
        page.tsx
        components/              used by this page only
    api/                         webhooks and cron endpoints

  components/                  shared components, by role
    ui/                          design-system pieces: inputs, tables, loaders, header
    providers/                   app-wide context: language, theme, Sentry
    brand/                       logo, footer, landing story, screenshots
    preferences/                 language, theme and reminder-language switches
    accounts/                    bank cards, card stack, balances, account tabs
    statements/                  statement import: column mapping, checks, gaps
    transactions/                transaction table and editing
    insights/                    "what changed" and the cash-flow forecast
    tour/                        starting the guided tour
    connect/                     direct bank links (Plaid, Setu), not switched on yet

  lib/                         shared logic, by kind
    finance/                     the money engine, pure functions, no I/O: spending, payees,
                                 regular payments, income and salary scoring, forecast,
                                 loans, charges, subscriptions, recharges, health, report
    content/                     fixed data and copy: plans and prices, card designs,
                                 bank guides, tour steps, About pages, SEO, site details
    server/                      server-only: data access, auth, payments, cache, rate limits
    actions/                     server actions: the only functions the browser can call
    statements/                  statement parsing (PDF, Excel, CSV) and its checks
    providers/                   statement, Plaid and Setu adapters
    i18n/                        11 languages: messages/<code>/*.json
    auth/                        sign-up rules and the session cookie, shared by both sides
    browser/                     browser-only helpers: the account-switch animation, Sentry
    utils.ts cache.ts ...        a few small helpers every layer uses

  proxy.ts                     renews sessions; shows the landing page to visitors at /
scripts/                       setup, admin and check scripts (each explains itself at the top)
tests/unit, tests/security     Vitest suites
```

The admin portal (people, codes, payments, feedback, lists, usage) is a
separate private app: github.com/hell-walk/Admin-Portal.
