# Writing and translating Horizon's interface

Horizon is for everyone with a bank account, including people who are not comfortable with technology or English. Every word on screen follows these rules.

## How text works in the code

- No hard-coded user-facing text. Every visible string, `aria-label`, `title`, placeholder and error message comes from the message files: `src/lib/i18n/messages/<lang>/<area>.json`.
- Keys are `area.camelCaseKey` (for example `transfer.reviewButton`). The area is the file name. Add every key to **both** `en/<area>.json` and `hi/<area>.json`. `npm test` fails if the two languages differ, a key is missing, or a `{placeholder}` is lost.
- Server components and server actions: `const t = await getT();` from `@/lib/i18n/server`.
- Client components (`"use client"`): `const t = useT();` from `@/components/i18nProvider`.
- A component with no directive is rendered wherever it is imported from. If any client component imports it, treat it as a client component (`useT`). If only server components render it and it can be `async`, use `getT`. Otherwise pass the translated text in as props.
- Fill-ins: `t("history.entries", { count: 3 })`. For counts, write `entries_one` and `entries_other`; `t` picks one from `count`.
- Numbers, money, dates, account digits, names, emails, payees and ids are **data, not text**: never translate them, and wrap them in an element with `translate="no"`. That way Chrome's built-in page translation does not mangle them either.
- Server action messages: tests check the English wording. Keep the English text exactly as it is, and add the translation through `getT()`.
- New languages: `GOOGLE_TRANSLATE_API_KEY=… node scripts/translate-messages.mjs <code>` makes a first draft from the English files. Only interface text is sent, never user data. A native speaker must proofread it.

## Plain English

- Write for someone who has never used a finance app. Short sentences, everyday words, one idea per sentence.
- Say what to do next in every error ("Check the amount and try again"), not just what went wrong.
- Labels are plain words. The design's small uppercase labels stay uppercase, but lose the code style: no `//`, no numbering like `01`, no technical words. "Action // 01" becomes "Quick action"; "Parsed // 2 transactions" becomes "We found 2 entries"; "Method // 02" becomes the method's name.

Glossary (use the plain word, everywhere):

| Instead of | Write |
|---|---|
| debit / Dr / withdrawal | money out |
| credit / Cr / deposit | money in |
| transactions (in titles) | entries, or payments when it is only money out |
| institution | bank |
| mask / masked number | last 4 digits |
| sharable id | receiving code (what others use to send you money) |
| parse / import | read / upload |
| provider | how it is connected |
| Account Aggregator | RBI's secure bank link (Account Aggregator) on first mention |
| sandbox | test mode |
| settlement | when the money arrives |
| authorize | confirm |

## Hindi

- Simple, everyday Hindi in Devanagari, the way a bank's helpline would speak to a customer. Not formal or Sanskrit-heavy.
- Keep words people already use in English: बैंक, खाता, स्टेटमेंट, पासवर्ड, ऐप, नेट बैंकिंग, ईमेल, मोबाइल, PDF, Excel, UPI, OTP, IFSC, PAN.
- Brand and product names stay in English: Horizon, Plaid, Setu, Dwolla, Google.
- Polite forms ("आप", "करें"). Same placeholders as English, in a natural place in the sentence.
- Money in: पैसे आए / जमा. Money out: पैसे गए / खर्च. Receiving code: पैसे पाने का कोड.
