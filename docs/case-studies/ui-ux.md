# Horizon: fifteen UI/UX case studies

Horizon is a personal-finance web app for India, used mostly on phones, in 11
languages. Its users are not finance people. Each study gives the problem as a
person met it, the decision, and the reasoning.

---

## 1. Sign-up friction: three small removals

**Problem.** The sign-up page had a progress strip ("About you / Address /
Login details"), a password rule reading "8 to 128 characters", and a
"Check your email" page that appeared even when no email would ever come.

**Decisions.**
- The strip was removed. The form is one page; a strip implied steps that did
  not exist.
- The rule became "At least 8 characters". Nobody types 128 characters, so the
  upper limit was noise.
- Signing up with an email that already has an account now says "This email
  already exists." with a single Sign in link. A longer first version explained
  why no email was sent; the owner asked for it to be cut to one sentence.

**Trade-off.** Telling people an email is registered lets a stranger test
addresses. Attempt limits per email and per network contain that; an honest
message was judged worth more than a hidden one.

---

## 2. One button was hiding two intentions

**Problem.** "Upload a statement" served both a brand-new account and more
months for an existing one. People adding months to an account sometimes
created a duplicate account.

**Decision.** Two buttons side by side: "Connect a new account" and "Add
statements to an existing account". The second opens the list of accounts
first, so the choice of account comes before the file, not after it.

**Reasoning.** When one control serves two goals, the system has to guess. Ask
the question in the order the person thinks about it.

---

## 3. Home: one primary action instead of four

**Problem.** Home opened with four "Quick action" cards (Upload, Bills,
Calendar, Goals). Three of them repeated the menu, each carried the label
"Quick action", and together they pushed the balance below the fold on phones.

**Decision.** The row was removed. One "Upload a statement" button sits in the
page header, because uploading is the one thing people come to Home to do. A
duplicate "see more" link inside the Coming up panel became plain text, since
the panel's header already links to the same page.

**Reasoning.** Every button competes with every other button. Shortcuts that
duplicate navigation cost attention and add nothing.

---

## 4. A page of their own for subscriptions and recharges

**Problem.** Subscriptions and recharges lived at the bottom of "EMIs and
loans". People looking for Netflix or their Jio plan did not think of loans.

**Decision.** A separate page, "Subscriptions and recharges", listed in the
menu, on the landing page and in the feature slideshow. The old address
redirects. The loans page was retitled "EMIs and loans".

**Reasoning.** Group things by how people name them, not by how the code finds
them. Both are "small money that comes back on its own"; a loan is a debt.

---

## 5. A guided tour that lets you leave

**Problem.** The tour moved people between pages. If they tapped a menu item
mid-tour, the tour pulled them back to its own page: every page looked like
Home.

**Decision.** The tour moves only when the person presses Next or Back. Leaving
by any other route ends it, and it can be restarted from About. The spotlight
also re-finds its target when a loading placeholder is replaced by the real
section.

**Reasoning.** Guidance must never take control away. An exit that works every
time is part of the feature.

---

## 6. Show the frame first, the numbers after

**Problem.** Pages waited for all data before showing anything. On a phone the
screen stayed blank for seconds.

**Decision.** Every page sends its header and layout at once, with loading
shapes the same size as the content. Each section streams in when its data is
ready. A cold server start (2.66 s to first byte, measured) is the remaining
delay; warm pages answer in about 0.4 s.

**Reasoning.** Perceived speed is about when something stable appears, not when
everything is done. Placeholders must match the final size or the page jumps.

---

## 7. "Why we think so"

**Problem.** Horizon detects bills, salary and subscriptions from patterns.
A wrong detection with no explanation destroys trust in the right ones.

**Decision.** Every detected payment has a "Why we think so" line: how many
times it was seen, since when, and the payments behind it. Low confidence is
said plainly: "seen once so far. We guess it renews monthly; another month's
statement will tell."

**Reasoning.** A guess that shows its evidence is useful even when wrong,
because the person can see why and correct it.

---

## 8. Ask, do not guess

**Problem.** Some things cannot be known from a statement: is this credit your
salary, is this transfer to your own account, which plan is this charge.

**Decision.** A "Quick checks" page asks short questions, one per uncertainty,
never the same one twice. Each answer becomes a rule that also fixes past and
future entries. A bar on Home says how many payments need a look and what is at
stake ("your charts and income figure may be off").

**Reasoning.** One answered question beats a hundred inferred labels. Say what
the answer improves, so the question feels worth answering.

---

## 9. When a payment disappears, suggest the likely reason

**Problem.** A recharge plan showed as lapsed and a bill as "stopped". The
real cause was usually that the person paid from another bank account that
Horizon had never seen.

**Decision.** Missed or stopped payments and lapsed plans now say: "Paid from
another account? Horizon only sees the statements you add", with a link to add
that account.

**Reasoning.** An alarm with no next step creates worry. Name the most likely
cause and offer the action that resolves it.

---

## 10. Saying how far the data reaches

**Problem.** On 1 November the monthly email reported September. The statements
stopped on 19 October, so October was silently skipped as incomplete.

**Decision.** The report covers the month that just ended and says "Your
statements reach 19 October. The rest of October is not in them yet: upload it
and this report fills in." The email says the same.

**Reasoning.** Showing partial data with its limit stated is honest. Silently
substituting older data looks like a bug, because it is one from the person's
side.

---

## 11. Do not claim the person did what the system did

**Problem.** Failed payments are paired and labelled "Reversed" automatically.
The history then showed "changed by you" and offered an undo, for a change the
person never made.

**Decision.** Those rows read "Reversed · paired with its reversal" and offer
no undo. A label the person sets by hand still shows "changed by you" and
always wins over the automatic one.

**Reasoning.** Attribution is part of trust. People need to tell their own
edits from the system's.

---

## 12. Eleven languages without translating the data

**Problem.** Many users read Hindi, Tamil or Bengali more comfortably than
English, but bank narrations and merchant names are in English.

**Decision.** All interface text is translated into 11 Indian languages, with a
test that every language has every key. Names that come from data (categories,
payees) stay in English internally so sorting and colours stay stable, and are
translated only at the moment of display. Merchant names and amounts are marked
so browser translation leaves them alone.

**Reasoning.** Translate what the product says, not what the bank wrote. A
mistranslated merchant name is worse than an English one.

---

## 13. Reminders that respect an inbox

**Problem.** Reminders are useful only if people keep them switched on.

**Decisions.**
- At most one message a day; what is due comes before the weekly "time for a
  statement" nudge.
- No amounts in emails or push messages: an inbox and a lock screen are not
  private places.
- The nudge originally went out only on Mondays and only after more than seven
  days, so a statement that fell behind on a Tuesday waited up to thirteen
  days. It now goes on the first quiet day the statements are a week old.

**Reasoning.** Restraint is a feature. So is timing: a rule that is correct but
late feels broken.

---

## 14. A paywall that shows what is behind it

**Problem.** The detailed loan analysis is for subscribers. A blank "Subscribe
to see this" page gives no reason to pay.

**Decision.** Everyone sees the headline numbers (how many lenders, how much a
month). The detail is shown as a blurred shape with a short explanation and one
button. After the 7-day trial the app becomes read-only rather than locked, and
exporting or deleting your data is never restricted.

**Reasoning.** Show enough for the value to be believable. Never hold a
person's own data hostage; that is where trust in a finance product ends.

---

## 15. From insight to action: the bank-charges letter

**Problem.** "Your bank took ₹1,860 in charges this year" is interesting and
useless. People do not know what to do with it.

**Decision.** The charges page groups fees by kind, says how to avoid each, and
produces a ready request to the bank to reverse them, with the dates and
amounts filled in and one tap to copy. Charges the bank already gave back are
subtracted.

**Reasoning.** An insight is finished only when the next step is one tap away.
This is also the feature no competing app offers, so it leads the landing page.
