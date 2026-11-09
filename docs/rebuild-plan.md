# Rebuild Horizon from scratch: 90 days, 3 hours a day

A plan for rebuilding Horizon yourself, feature by feature, so that you
understand every part of it. It is written to be pasted into Gemini together
with the code.

## How each day works (3 hours)

| Time | What you do |
|---|---|
| 0:00 to 0:40 | **Read.** Open the day's files in the original repo. Paste them into Gemini with the "Explain" prompt below. Take notes by hand. |
| 0:40 to 2:20 | **Build.** Close the original. Write the feature in your own new repo from your notes. Look back only when stuck for 15 minutes. |
| 2:20 to 2:45 | **Check.** Run it. Write one test. Paste your version into Gemini with the "Review" prompt. |
| 2:45 to 3:00 | **Log.** Three lines in `LEARNING.md`: what I built, what confused me, one question for tomorrow. |

Day 7 of every week is a catch-up and review day: finish what slipped, then
answer the week's quiz without looking.

## Rules

1. Type every line yourself. Do not copy files from the original.
2. Never paste `.env`, keys, tokens or real statements into Gemini. Paste code
   only. Use made-up rows when you need sample data.
3. Before you start, check with the company which parts of the code you may
   keep and study after leaving.
4. One new repo, one commit per day at least. The history is your proof of
   work.
5. If a day runs over, stop at 3 hours and use Day 7.

## The prompts to paste into Gemini

**Master prompt (start of every new chat):**

```
You are my tutor. I am rebuilding a personal-finance web app called Horizon
from scratch to learn it. Stack: Next.js 16 App Router with server actions,
React 19, TypeScript, Tailwind CSS 4, Supabase for login, Appwrite for data,
Upstash Redis, Razorpay, Vercel. I study 3 hours a day.

How to teach me:
- Explain in simple English. Short sentences.
- When I paste a file, first say in 3 lines what it is for. Then walk through
  it top to bottom. Explain why each part exists, not only what it does.
- Point out every place where the code protects against a mistake or an
  attack, and say what would go wrong without it.
- Do not rewrite the file for me. I will write my own version.
- End with 5 questions that test whether I understood. Wait for my answers,
  then correct them.
I will tell you which week and day of my plan I am on.
```

**Explain prompt (reading time):**

```
Week <N>, Day <D>. Today's goal: <goal from the plan>.
Here are the files from the original app. Explain them as my tutor.
<paste files, each under a line with its path>
```

**Review prompt (after building):**

```
Here is my own version of today's feature. Review it like a senior engineer:
1. Bugs, with the input that triggers each.
2. Security problems.
3. Where it differs from the original's approach and which is better.
4. One thing to simplify.
Do not give me the fixed code. Give me hints, and let me fix it.
<paste your files>
```

**Quiz prompt (Day 7):**

```
Quiz me on week <N> of my plan: <week title>. Ask 10 questions, one at a time,
from easy to hard. Include 3 "what breaks if we remove this line" questions.
After each answer, tell me if I am right and why.
```

---

## Month 1: the skeleton, login and getting data in

### Week 1. Foundations: the app shell

Goal: an empty app with the real layout, routes and design tokens.

| Day | Build | Read in the original |
|---|---|---|
| 1 | New Next.js 16 + TypeScript project. Understand App Router: `layout.tsx`, `page.tsx`, server vs client components. | `README.md`, `package.json`, `next.config.ts`, `src/app/layout.tsx` |
| 2 | Tailwind 4 with design tokens (colours, type scale, light and dark). | `src/app/globals.css`, `postcss.config.mjs`, `src/components/providers/themeProvider.tsx` |
| 3 | Route groups: `(auth)`, `(root)`, `(legal)`, `(marketing)`. An empty page in each. | folder names under `src/app`, `src/app/(root)/layout.tsx` |
| 4 | The signed-in shell: top bar, phone bottom bar, "More" menu. | `src/app/(root)/components/*`, `src/constants/index.ts` |
| 5 | Shared UI pieces: header box, buttons, panel, skeleton loaders. | `src/components/ui/headerBox.tsx`, `loaders.tsx`, `skeletons.tsx` |
| 6 | The folder rule and a test that enforces it. | `tests/unit/structure.test.ts`, README "Project structure" |
| 7 | Catch up. Quiz. | |

Done when: the app runs, has four route groups, a shell that works on a phone,
and light and dark themes.

### Week 2. Login with Supabase

Goal: sign up, confirm by email, sign in, reset password, sign out.

| Day | Build | Read |
|---|---|---|
| 8 | Supabase project. Server client with cookies. Why keys stay server-only. | `src/lib/server/supabase.ts`, `src/lib/auth/sessionCookie.ts` |
| 9 | Sign-up form with react-hook-form and zod. Live password rules. | `src/app/(auth)/components/authForm.tsx`, `passwordRules.tsx`, `src/lib/auth/authSchema.ts`, `passwordRules.ts` |
| 10 | `signUp` and `signIn` server actions. Same error for wrong password and unknown email, and why. | `src/lib/actions/user.action.ts` (top half) |
| 11 | Email confirmation and reset links. Token-hash links that survive email scanners. | `src/app/(auth)/auth/confirm`, `auth/callback`, `passwordForms.tsx` |
| 12 | Reading the session on every page. The 60-second memo and `forgetLogin`. | `src/lib/server/auth.ts`, `loginMemo.ts`, `src/proxy.ts` |
| 13 | Rate limits with Redis: per email, per network. | `src/lib/server/rateLimit.ts`, `redis.ts`, `shared.ts` |
| 14 | Catch up. Quiz. | |

Done when: a new email can sign up, confirm, sign in, reset its password, and
five wrong passwords get slowed down.

### Week 3. Data and ownership

Goal: a profile and bank records that only their owner can reach.

| Day | Build | Read |
|---|---|---|
| 15 | Appwrite project, tables, admin client. `server-only`. | `src/lib/server/appwrite.ts`, `banks.ts` |
| 16 | Profile creation on the first visit after confirming (`/welcome`). | `src/lib/server/profile.ts`, `src/app/(auth)/welcome` |
| 17 | Server actions: what they are, why every export is a public endpoint. | `src/lib/actions/card.action.ts`, `goal.action.ts` |
| 18 | The ownership rule: every query limited to the signed-in person. | `src/lib/server/auth.ts` (`ownerIdOf`), `accounts.ts`, `ownerAccounts.ts` |
| 19 | Encrypting stored secrets. Logging without leaking. | `src/lib/server/crypto.ts`, `log.ts`, `src/lib/scrub.ts` |
| 20 | Preferences stored per person (`prefs`). Goals page end to end as practice. | `src/lib/server/prefs.ts`, `goals.ts`, `src/app/(root)/(goals)` |
| 21 | Catch up. Quiz. | |

Done when: two accounts exist and neither can read or change the other's
goals, even by sending the other's id.

### Week 4. Statement import, part 1: CSV

Goal: upload a CSV statement, check it, save it without duplicates.

| Day | Build | Read |
|---|---|---|
| 22 | Read a CSV into rows of cells. Sniff the file by its bytes. | `src/lib/statements/parse.ts` (readers) |
| 23 | Find the header row and the columns: date, narration, debit, credit, balance. | `parse.ts` (header detection), `tests/unit/statements/parse.test.ts` |
| 24 | Dates (day-first or month-first) and amounts (commas, Dr/Cr, brackets). | `parse.ts` (dates and amounts), `tests/unit/statements/formats.test.ts` |
| 25 | Row hashes so the same row is never saved twice. | `parse.ts` (`transactionHashes`), `src/lib/statements/overlap.ts` |
| 26 | The preview step: show what was read before saving. | `src/lib/actions/statement.action.ts`, `src/components/statements/importStatement.tsx` |
| 27 | Save rows with their position (`seq`). Read them back in order. | `statement.action.ts` (import), `src/lib/providers/manual.ts` |
| 28 | Catch up. Quiz. | |

Done when: uploading the same CSV twice saves its rows once, in the bank's
order.

---

## Month 2: the money engine

### Week 5. Statement import, part 2: Excel, PDF, safety

| Day | Build | Read |
|---|---|---|
| 29 | Excel files, including old `.xls` and HTML tables named `.xls`. | `parse.ts` (xlsx readers) |
| 30 | Password-protected Excel and PDF. The password is used once and never stored. | `src/lib/statements/unlock.ts` |
| 31 | PDF text to table: lines, column anchors, wrapped narrations. | `unlock.ts` (`parsePdfRows`) |
| 32 | Files with no header: infer columns from the running balance. | `parse.ts` (`inferColumns`), `tests/unit/statements/balance-mapping.test.ts` |
| 33 | Limits and the isolated worker: memory cap, time limit, empty environment. | `src/lib/statements/limits.ts`, `isolated.ts`, `parse-worker.ts`, `scripts/build-parse-worker.mjs` |
| 34 | Gaps, doubtful rows and the balance check shown to the person. | `gaps.ts`, `doubtful.ts`, `rowOrder.ts`, `src/components/statements/*` |
| 35 | Catch up. Quiz. | |

Done when: a password PDF imports, and a 250-page PDF or a zip bomb is refused
in under a second.

### Week 6. Categories, payees and the Home dashboard

| Day | Build | Read |
|---|---|---|
| 36 | Who was paid: clean a bank narration into a payee name. | `src/lib/finance/payees.ts`, `tests/unit/spending-payees.test.ts` |
| 37 | Categories and plain-language spending buckets. Order of rules matters. | `src/lib/finance/categories.ts`, `spending.ts` |
| 38 | Corrections: the person's own names and labels, per row and per payee. | `src/lib/finance/corrections.ts`, `src/lib/actions/correction.action.ts` |
| 39 | Charts with chart.js, loaded lazily. | `src/app/(root)/(home)/components/doughnutChart*.tsx`, `categoryPanel.tsx` |
| 40 | The Home page: streaming sections with Suspense and skeletons. | `src/app/(root)/(home)/page.tsx` |
| 41 | Account history table with editing. | `src/components/transactions/*`, `src/app/(root)/(transaction-history)` |
| 42 | Catch up. Quiz. | |

Done when: Home shows a balance, a spending doughnut and recent entries, and
renaming a payee once fixes all its rows.

### Week 7. Regular payments, subscriptions, recharges

| Day | Build | Read |
|---|---|---|
| 43 | Detect a rhythm: gaps between payments, bands, confidence. | `src/lib/finance/recurring.ts` (`cadenceOf`, `findRegular`) |
| 44 | Missed, stopped, upcoming: judged against where the statements end, not today. | `recurring.ts` (status), `tests/unit/recurring.test.ts` |
| 45 | The Bills page with "Why we think so". | `src/app/(root)/(bills)`, `src/lib/finance/regularText.ts` |
| 46 | Subscriptions: one merchant, several plans, split by amount. | `src/lib/finance/subscriptions.ts`, `planNames.ts`, `recurring.ts` (`splitByAmount`) |
| 47 | Recharges: plan model, add-ons, the GST-in-paise test. | `src/lib/finance/recharges.ts`, `tests/unit/recharges.test.ts` |
| 48 | The Subscriptions and recharges page. | `src/app/(root)/(subscriptions)` |
| 49 | Catch up. Quiz. | |

Done when: four monthly payments are found as one bill with the next date, and
a ₹349 recharge shows as a 28-day plan.

### Week 8. Income, questions, loans, charges

| Day | Build | Read |
|---|---|---|
| 50 | Money in per month. The direction bug and its tests. | `src/lib/finance/income.ts` (`creditsIn`), `tests/unit/income.test.ts` |
| 51 | Salary scoring: points, exclusions, three confidence levels. | `income.ts` (`salaryCandidates`), `tests/unit/salary-profiles.ts`, `salary-scoring.test.ts` |
| 52 | The income chooser: verify, ask, pick. | `src/app/(root)/(home)/components/incomeChooser.tsx`, `src/lib/actions/income.action.ts`, `src/lib/server/income.ts` |
| 53 | Quick checks: questions that become rules. | `src/lib/finance/checks.ts`, `src/lib/actions/checks.action.ts`, `src/app/(root)/(checks)` |
| 54 | EMIs and loans by lender; the payoff planner. | `src/lib/finance/loans.ts`, `payoff.ts`, `src/app/(root)/(loans)` |
| 55 | Bank charges and the reversal letter. | `src/lib/finance/charges.ts`, `chargesLetter.ts`, `src/app/(root)/(charges)` |
| 56 | Catch up. Quiz. | |

Done when: your 40 salary profiles pass, and the charges page produces a
letter you could send.

---

## Month 3: the product around the engine

### Week 9. Forecast, calendar, health, report, reversals

| Day | Build | Read |
|---|---|---|
| 57 | "Will I have enough money?": forecast to the next pay day. | `src/lib/finance/forecast.ts`, `src/components/insights/forecastPanel.tsx` |
| 58 | Cash-flow calendar. | `src/lib/finance/calendar.ts`, `cashflow.ts`, `src/app/(root)/(calendar)` |
| 59 | Health score from its parts. | `src/lib/finance/health.ts`, `tests/unit/health.test.ts` |
| 60 | Monthly report: which month, partial months. | `src/lib/finance/report.ts`, `src/app/(root)/(report)` |
| 61 | Reversed payments and the `leftOut` helper. | `src/lib/finance/reversals.ts`, `corrections.ts`, `tests/unit/reversals.test.ts` |
| 62 | Insights and the weekly recap. An end-to-end pipeline test. | `src/lib/finance/insights.ts`, `recap.ts`, `tests/unit/pipeline.test.ts` |
| 63 | Catch up. Quiz. | |

### Week 10. Plans and payments

| Day | Build | Read |
|---|---|---|
| 64 | Trial, subscribed, read-only: the plan as data. | `src/lib/content/plans.ts`, `src/lib/server/plan.ts` |
| 65 | Gating a feature: headline free, detail for subscribers. | `src/app/(root)/(loans)/loans/page.tsx` (`Locked`), `(spending)` |
| 66 | Razorpay subscription and in-page checkout (test mode only). | `src/lib/server/razorpay.ts`, `src/lib/actions/plan.action.ts`, `src/app/(root)/(plans)` |
| 67 | The webhook: signature check, size limit, logging after the reply. | `src/app/api/razorpay/webhook/route.ts`, `src/lib/server/webhookLog.ts` |
| 68 | Not depending on the webhook: hourly re-check. | `plan.ts` (`refreshIfStale`) |
| 69 | Promo and referral codes. | `src/lib/server/codes.ts`, `scripts/make-code.mjs` |
| 70 | Catch up. Quiz. | |

### Week 11. Languages, reminders, landing page, tour

| Day | Build | Read |
|---|---|---|
| 71 | Translation: keys, plurals, server and client translators. | `src/lib/i18n/*.ts`, `src/lib/i18n/messages/en/*.json`, `tests/unit/i18n.test.ts` |
| 72 | Translating data names only on display. | `src/lib/i18n/labels.ts`, `src/components/preferences/*` |
| 73 | Reminders: what to send today, at most one. | `src/lib/finance/notify.ts`, `src/lib/server/notify.ts`, `tests/unit/notify.test.ts` |
| 74 | Web push and email; the daily cron and its secret. | `src/lib/actions/notify.action.ts`, `src/app/api/cron/reminders/route.ts`, `vercel.json` |
| 75 | The public landing page and its screenshots. | `src/app/(marketing)`, `src/components/brand/*`, `src/lib/content/aboutFeatures.ts`, `scripts/capture-landing-shots.mjs` |
| 76 | The guided tour. | `src/app/(root)/components/tourGuide.tsx`, `src/lib/content/tour.ts` |
| 77 | Catch up. Quiz. | |

### Week 12. Security, backups, deploy

| Day | Build | Read |
|---|---|---|
| 78 | Security headers and CSP. Secrets never in `NEXT_PUBLIC_`. | `next.config.ts`, `src/proxy.ts`, `scripts/check-deployment.mjs` |
| 79 | Black-box security tests: anonymous attacker. | `tests/security/client.ts`, `anonymous.test.ts` |
| 80 | The authorization grid. Add a case for every action you wrote. | `tests/security/authorization-grid.test.ts`, `scripts/security-local.mjs` |
| 81 | Secret scanning and the pre-commit hook. | `scripts/scan-secrets.mjs`, `check-staged.mjs`, `secret-patterns.mjs` |
| 82 | Backups: export, encrypt, upload to R2, restore. | `src/lib/server/backup.ts`, `r2.ts`, `scripts/restore-backup.mjs` |
| 83 | Deploy to Vercel. Environment variables, cron, Sentry. | `docs/deploy-vercel.md`, `sentry.*.config.ts`, `.github/workflows/*.yml` |
| 84 | Catch up. Quiz. | |

### Final six days (85 to 90): prove it

| Day | Task |
|---|---|
| 85 | Privacy: export my data and delete my account, end to end. Read `src/lib/actions/privacy.action.ts`, `src/lib/server/userData.ts`. |
| 86 | Performance: measure first byte cold and warm; add timing; fix the slowest thing. Read `src/lib/server/timing.ts`, `cache.ts`. |
| 87 | Pick one feature and rebuild it blind in 3 hours without opening the original. |
| 88 | Run your full test suite and security suite. Fix what fails. |
| 89 | Write two case studies of your own in the style of `docs/case-studies/`. |
| 90 | Record a 10-minute walk-through of your app. Update your CV. |

---

## What to study when

The original's logic is easiest to learn in this order, because each file
only needs the ones before it:

1. `src/lib/finance/payees.ts`, `categories.ts`, `spending.ts`
2. `corrections.ts`, `reversals.ts`
3. `recurring.ts`, then `subscriptions.ts`, `recharges.ts`, `loans.ts`
4. `income.ts`, `checks.ts`
5. `forecast.ts`, `calendar.ts`, `health.ts`, `report.ts`

Everything in `src/lib/finance` is pure: no database, no network. It is the
best place to learn, because every function can be tested with plain rows.

## If you fall behind

Drop in this order, last first: Week 10 day 69 (codes), Week 11 day 76 (tour),
Week 9 day 62 (insights), the Plaid and Setu providers (not in this plan at
all). Never drop a Day 7 quiz, the tests, or Week 12.
