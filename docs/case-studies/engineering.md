# Horizon: ten engineering case studies

Horizon is a personal-finance web app for India. People upload bank statements
(PDF, Excel, CSV) and it finds bank charges, EMIs, subscriptions, recharges and
salary, forecasts the month, and reports on it. Stack: Next.js 16 (App Router,
server actions), React 19, TypeScript, Tailwind 4, Supabase (login), Appwrite
(data), Upstash Redis, Razorpay, Brevo, Cloudflare R2, Vercel.

Each study follows the same shape: the situation, what was found, what was
decided, the result, and the lesson. Every number here was measured, not
estimated.

---

## 1. Money going out was counted as money in

**Situation.** The income figure on Home looked high, and the "salaried" check
accepted almost anyone.

**What was found.** Statement rows store every amount as a positive number and
keep the direction in a separate `type` field (`debit` or `credit`). The income
reader tested `amount > 0` to find credits, so every debit counted as money
in. On a real account money in was 2.0 times the truth, and a monthly streaming
subscription was detected as an "employer".

**Decision.** The direction field decides; the sign is used only for rows that
have no type. The tests were the deeper problem: their helper built debits with
negative amounts, a shape real data never has. The helpers were rewritten to
produce rows shaped like real statements, and regression tests were added that
fail on the old code.

**Result.** Money in equals real credits. A steady debit can no longer be a
salary.

**Lesson.** Tests that build data in a convenient shape prove the code against
the wrong world. Fixtures must copy production's shape exactly.

---

## 2. Salary detection that verifies before it believes

**Situation.** A person who ticks "salaried" unlocks income-based features
(EMI share of income, the forecast). The old rule accepted 3 of 8 genuinely
salaried profiles and wrongly accepted company rent and mutual-fund payouts.

**Decision.** Replace the yes/no rule with a score per paying party:
salary wording or a government pay office (+3), a company name (+1), a bank
rail such as NEFT (+1), months seen (+1 or +2), steadiness of the amount (+1 or
+2), timing within five days each month (+1), tiny amounts (−3). Fund payouts,
rent, pension, refunds and the person's own transfers can never be a salary.
The score gives three outcomes: sure (accepted), likely (the person is asked
"Is this your salary?"), otherwise the person picks from what came in. The
server saves "salaried" only for a credit it can find in that person's own
statements.

**Result.** 40 realistic profiles are kept as a permanent test; all 40 are
classified correctly. A reverse check asks people who said "no income" but
receive a salary.

**Lesson.** When a rule cannot be certain, design the uncertain middle
explicitly: accept, ask, or let the person choose.

---

## 3. Reading statements from any bank without trusting the file

**Situation.** Indian banks export statements in many layouts: PDFs with and
without passwords, Excel files that are really HTML, files with no header row.

**Decision.**
- Sniff files by their bytes, not their extension.
- Find columns from header words; when there is no header, infer them, using
  the running balance to tell debits from credits.
- For PDFs, snap text to column anchors and fold wrapped narrations.
- Let the person map columns once when detection fails, and remember the layout
  per bank.
- Run every parse in a disposable worker thread with a memory cap, a time limit
  and an empty environment, so a crafted file can exhaust only itself and there
  are no secrets in the worker to steal.

**Result.** 12 synthetic bank layouts plus fuzz tests run in CI. A zip bomb, a
250-page PDF and an oversized body are all refused quickly in the security
suite.

**A gap found later.** When a PDF library crashed, the worker replaced its
error with a generic sentence and the cause was lost. The library's own words
now reach the server log (never the file's content).

**Lesson.** Treat every upload as hostile and every failure as something you
will need to diagnose later.

---

## 4. Failed payments were counted twice

**Situation.** An audit of every real row (4,195 rows, 8 profiles) showed days
whose balances did not add up.

**What was found.** Nothing was misread. A failed UPI payment appears as a
debit and, a day or two later, a credit of the same amount with the same
reference number. Horizon counted the debit as spending and the credit as
income. Nine pairs, ₹6,372 of spending that never happened.

**Decision.** Pair a debit with a credit of the same amount within three days
when they share a reference number or the credit says reversal, refund or
failed. Label both rows "Reversed". One helper, `leftOut`, replaced fourteen
separate "is this an own transfer?" checks, so every total (spending, income,
bills, loans, health score, report, forecast) leaves both kinds out the same
way. A label the person set by hand always wins.

**Result.** Spending fell by exactly ₹6,372 across three real accounts, and
day-level balance reconciliation reached 100%.

**Lesson.** Reconciliation against an independent column (the balance) is the
strongest accuracy test a finance app has. Build it early.

---

## 5. Recovering the bank's row order from the balances

**Situation.** Entries on the same day appeared shuffled. The parser kept the
right order, but rows were saved in parallel and the table had no position
field.

**Decision.** Save each row's position (`seq`) on import and sort by date then
position. For the 4,000 rows already saved, recover the order from the balance
column: each balance equals the previous balance plus or minus the row's
amount, so a day's rows chain in exactly one way. A reversed payment returns
the balance to an earlier value, so the walk must backtrack rather than take
the first row that fits.

**Rollout.** The new sort fails if the field does not exist, so the order of
operations mattered: create the field, backfill, verify, then deploy. The push
was refused until a check showed the field was live.

**Result.** Every real account chains balance to balance in stored order,
strictly: 1,504 of 1,504, 499 of 499, 183 of 183.

**Lesson.** A schema change and the code that needs it are one release with a
required order. Verify the precondition in the deploy step, not in your head.

---

## 6. Prepaid recharges: modelling the plan, not the average

**Situation.** A user on a ₹349 Jio plan (28 days) was shown "₹253 a month,
every 42 days".

**What was found.** The code averaged every payment to the operator. That
account held two ₹349 plans, a ₹69 data add-on and ₹1,060.82, which the user
confirmed was home wifi (₹899 plus 18% GST), all paid through the same app.

**Decision.** Each recharge is its own plan; the latest plan decides price,
length, next due date and monthly cost. Two rules separate what looks alike:
prepaid prices already include GST, so recharges are whole rupees, while bills
add GST on top and end in paise; and a small payment that matches no known plan
is an add-on that never moves the plan. Plan lengths come from the person,
then a plan table the team can edit without a deploy, then the gaps.

**Result.** The plan shows as ₹349, 28 days, about ₹379 a month, with the wifi
bill left out and named. The same paise test later let the Bills page show a
wifi bill after a single payment.

**Lesson.** Domain facts (GST is included in prepaid prices) beat statistics.

---

## 7. A one-minute cache that outlived the truth

**Situation.** To speed up pages, each server copy remembered the signed-in
session and profile for 60 seconds.

**What was found.** Nothing ever cleared that memory. The black-box security
test for account deletion failed: a deleted account's cookie kept opening pages
for up to a minute. The same staleness meant someone who had just paid could
still see the trial.

**Decision.** One function, `forgetLogin`, drops everything remembered about a
login on every device. It is called after a payment, a redeemed code, profile
creation, a language or password change, sign-out and deletion. The memo moved
into its own module so the code that changes a login can clear it without an
import cycle.

**Result.** The deletion test passes; a payment shows on the next page.

**Lesson.** A cache is a second copy of the truth. Write the invalidation the
same day you write the cache, and keep a test that deletes something and then
tries to use it.

---

## 8. A security suite that attacks the real build

**Situation.** Unit tests mock the database and cannot see authorization
mistakes.

**Decision.** A black-box suite runs against a production build: raw HTTP,
server actions called by id, forged headers and cookies, hostile files,
unsigned webhooks. Its core is an authorization grid: every public server
action is called by account A with account B's ids and forged ownership fields,
and nothing may succeed against B. A coverage test reads the build's action
manifest, so a new action without a grid case fails the run.

**What it caught.** The stale-session bug in study 7, and three actions that
had shipped without being reviewed against the grid.

**Making it used.** The suite needed a server, two throwaway logins and
several environment variables, so it was rarely run. One command now builds,
starts a server on its own port, runs all 148 tests and stops the server.

**Lesson.** A check that takes five steps is a check nobody runs. Reduce it to
one command.

---

## 9. Backups that were proven by restoring

**Situation.** All user data lived in one hosted database with no copy.

**Decision.** A nightly job exports every table (discovered live, so a new
table is never missed) and every login, compresses the file, encrypts it with
AES-256-GCM using a key that exists only in the environment, and uploads it to
Cloudflare R2. Copies older than 30 days are removed, never the newest. The
upload uses a hand-signed S3 request (about 60 lines) instead of a large SDK.
Until storage is configured the job answers "not configured" rather than
failing quietly.

**Proof.** The first run copied 10 tables, 4,323 rows and 15 logins into 346 KB
in 5.8 seconds. It was downloaded, decrypted and compared against the live
database: 0 rows missing. The decrypted copy was then deleted.

**Limit, stated plainly.** Logins can be listed but not re-created with their
passwords; restored users reset their password.

**Lesson.** A backup is only real after a restore. Ship the restore script in
the same change.

---

## 10. Payments that do not depend on the webhook

**Situation.** Razorpay subscriptions went live, but the webhook that should
confirm payments never arrived, and the dashboard showed no delivery logs.

**What was found.** The webhook had been created in live mode while the keys
in use were test keys. Test mode listed zero webhooks. Creating one through the
API in the right mode delivered an event in three seconds.

**Decision.** Fix the mode, but also remove the dependency: the server confirms
a payment itself from the checkout signature, and re-checks any unconfirmed or
soon-to-expire subscription with Razorpay hourly. The webhook became a faster
path, not the only path. Delivery-log rows had also been lost because they were
written after the response was sent; they now use the framework's `after()`.

**Result.** The first real payment was confirmed correctly, with the webhook
and the fallback agreeing.

**Lesson.** For money, never rely on a single inbound signal you do not
control. Poll as well.
