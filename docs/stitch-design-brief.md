# Horizon Design Brief for Stitch

Goal: a fresh, distinct visual design for Horizon that keeps the current screens, layout and components but drops the current blue-gradient look.

## Links

| What | Link | Use it for |
| --- | --- | --- |
| FigJam flow board | https://www.figma.com/board/KtF7XeCMJfKpSmnS1YZqOv/Horizon-Banking-App-Flow?node-id=0-1&p=f&t=dJxvXi6ppY7EakhG-0 | The screen-to-screen flow: sign up, sign in, home, my banks, transaction history, payment transfer, connect bank |
| Figma design file (current look) | https://www.figma.com/design/jvcjzjCKw9YlhCNOIY1GPY/Horizon-Banking-App?node-id=8-1975 | The existing JS Mastery design. Reference for layout and content only; the new design must not look like it |
| GitHub repo | https://github.com/hell-walk/horizon | Live component structure; palette in `tailwind.config.ts`, utility classes in `src/app/globals.css` |

## What Horizon is and the screens Stitch has to design

Horizon is a personal finance dashboard: one place to see every bank account, its balance, and its transactions, and to send money between accounts. Banks connect three ways: Plaid (US, sandbox demo), Setu Account Aggregator (India, sandbox demo), or a statement import (CSV/XLSX of a real Indian account). Balances show per currency (USD and INR), never added together.

| Screen | Route | What is on it |
| --- | --- | --- |
| Sign up | `/sign-up` | First/last name, address, city, state, postal code, date of birth, SSN, email, password; link to sign in |
| Sign in | `/sign-in` | Email + password; inline error line; link to sign up |
| Home | `/` | Greeting header, total balance box (doughnut of balances + per-currency totals + bank count), recent transactions tabbed per bank, right sidebar with profile, bank cards and top categories |
| My banks | `/my-banks` | Grid of bank cards (one per linked account, gradient card with name, mask, balance) |
| Transaction history | `/transaction-history` | Bank selector, account header with balance, full transaction table with category chips and paging |
| Payment transfer | `/payment-transfer` | Form: source bank, note, recipient email, recipient sharable id, amount |
| Connect a bank | Sidebar actions | Plaid Link button, Setu consent button, statement import dialog (file + institution + account mask) |
| Setu callback | `/setu/callback` | Consent result page with a continue action |
| Legal + 404 | `/privacy`, `/terms`, not found | Plain text pages with the public footer |

Layout facts to keep: desktop = fixed left sidebar (logo, five nav links, connect actions, user footer with logout), scrolling middle column, optional fixed right sidebar on Home; mobile = top bar with logo and a sheet menu. Home is meant to fit one viewport with internal scrolling.

## Current colours, gradients, shadows and fonts (what the new design must NOT reuse)

This is the exact palette in `tailwind.config.ts` today. Treat it as the "avoid" list: the new design should not lean on this blue family, the blue-to-light-blue gradient, or Inter.

### Brand and blues

| Token | Hex | Where it shows |
| --- | --- | --- |
| bankGradient | #0179FE | Primary buttons, active nav link, links, logo diamond |
| blue-25 | #F5FAFF | Hover tints, light panels |
| blue-100 | #D1E9FF | Chips, soft borders |
| blue-500 | #2E90FA | Secondary accents |
| blue-600 | #1570EF | Button hover |
| blue-700 | #175CD3 | Pressed state, category chip text |
| blue-900 | #194185 | Dark headings on blue |
| sky-1 | #F3F9FF | Page/section background wash |
| black-1 | #00214F | Headline text on cards |
| black-2 | #344054 | Body text |
| indigo-500 | #6172F3 | Category chips |
| indigo-700 | #3538CD | Category chip text |

### Greys (Untitled UI scale)

| Token | Hex |
| --- | --- |
| gray-25 | #FCFCFD |
| gray-200 | #EAECF0 |
| gray-300 | #D0D5DD |
| gray-500 | #667085 |
| gray-600 | #475467 |
| gray-700 | #344054 |
| gray-900 | #101828 |

### Semantic colours

| Token | Hex | Meaning |
| --- | --- | --- |
| success-25 | #F6FEF9 | Credit row tint |
| success-50 | #ECFDF3 | Success chip background |
| success-100 | #D1FADF | Success chip border |
| success-600 | #039855 | Credit amounts, success text |
| success-700 | #027A48 | Success chip text |
| success-900 | #054F31 | Dark success |
| pink-25 | #FEF6FB | Pink chip background |
| pink-100 | #FCE7F6 | Pink chip border |
| pink-500 | #EE46BC | Pink accent |
| pink-600 | #DD2590 | Pink chip text |
| pink-700 | #C11574 | Pink pressed |
| pink-900 | #851651 | Dark pink |
| debit red (hard-coded) | #F04438 | Debit amounts |
| debit row tint (hard-coded) | #FFFBFA | Debit row background |
| fill-1 | rgba(255,255,255,0.10) | Glass fill on bank cards |

### Gradients

| Name | Value | Used on |
| --- | --- | --- |
| bank-gradient | linear-gradient(90deg, #0179FE 0%, #4893FF 100%) | Bank card background, primary CTA |
| bank-green-gradient | linear-gradient(90deg, #01797A 0%, #489399 100%) | Alternate bank card |
| gradient-mesh | /icons/gradient-mesh.svg overlay | Bank card texture |
| doughnut chart | #0747B6, #2265D8, #2F91FA | Balance doughnut segments |

### Shadows

| Name | Value |
| --- | --- |
| form | 0 1px 2px rgba(16,24,40,0.05) |
| chart | 0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06) |
| profile | 0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03) |
| creditCard | 8px 10px 16px rgba(0,0,0,0.05) |

### Typography

| Role | Font | Notes |
| --- | --- | --- |
| UI and body | Inter | Sizes 10 to 36 px via custom text-NN classes, weights 400 to 700 |
| Logo wordmark | IBM Plex Serif | Only the word "Horizon" next to the diamond |

Shadcn base tokens are the default zinc set (background 0 0% 100%, foreground 240 10% 3.9%, radius 0.5rem). Icons are flat SVGs in `/public/icons`, mostly a single blue or grey stroke.

## Components and constraints the new design must keep

The code is React 19 + Next.js 16 with shadcn (Radix) components and Tailwind. Stitch can restyle everything, but these pieces exist and should map one-to-one so the redesign is a reskin, not a rebuild.

| Component | Content it must hold | Notes for the redesign |
| --- | --- | --- |
| Sidebar | Logo, 5 nav links with icon + label, connect-bank actions, user name/email, logout | Active link needs a clear state; collapses to a sheet on mobile |
| Total balance box | Doughnut (one segment per account), bank count, one total per currency | Doughnut colours can change; keep up to 6 distinct segment colours |
| Bank card | Account name, masked number, holder name, balance, copy sharable id | Today a blue gradient; the fresh design can use solid, dark or textured cards |
| Recent transactions | Tabs per bank, account summary, 10 newest rows, View all link | Tabs come from shadcn Tabs |
| Transaction table | Columns: transaction, amount, status, date, channel, category | Debit rows tinted red, credit rows tinted green; category is a chip with its own colour set |
| Right sidebar | Profile banner with initial avatar, name, email; My banks list with Add bank; top categories with progress bars | Progress bars need a category colour scale |
| Auth form | Grouped inputs, primary button with loading spinner, inline error text, honeypot field (hidden) | Keep labels above inputs |
| Payment transfer form | Select (source bank), textarea (note), inputs (email, sharable id, amount), submit | Long form; needs section rhythm |
| Statement import dialog | File picker (CSV/XLSX), institution, last 4 digits, result message | shadcn Dialog |
| Plaid / Setu buttons | Three variants: primary, ghost (sidebar), add (text + icon) | |
| Skeletons + loading | Grey pulse blocks for balance box, cards, table | Pick a neutral that matches the new palette |
| Site footer | Copyright, Privacy, Terms, support email | Public pages only |

Constraints: text sizes are custom classes from 10 px to 36 px; icons are stroke SVGs that take one colour; amounts use INR with the en-IN grouping and USD with en-US; the right sidebar is hidden below 1280 px; status chips exist for success, pink, indigo and grey.

## Three distinct directions to pick from

Each one stays far from the current blue-gradient, Inter, white-card look. Pick one and paste its palette into the Stitch prompt below.

### A. Warm editorial (recommended)

Cream paper background, ink-black text, a single terracotta accent, serif display headings, hairline dividers instead of card shadows. Reads like a printed statement; calm for a money app.

| Role | Hex |
| --- | --- |
| Background | #F7F3EC |
| Surface | #FFFDF9 |
| Ink (text) | #1B1A17 |
| Muted text | #6B655C |
| Border | #E4DDD1 |
| Accent (CTA, active nav) | #C2410C |
| Accent soft | #FCE8DC |
| Credit | #2F6F4E |
| Debit | #B42318 |
| Bank card | #1B1A17 with #C2410C stripe |
| Fonts | Fraunces or Newsreader (headings), Source Sans 3 or Manrope (body), JetBrains Mono (amounts) |

### B. Dark fintech

Near-black UI, lime or mint accent, glassy panels with 1 px borders, monospaced numerals. Feels like a trading terminal; strong for the doughnut and charts.

| Role | Hex |
| --- | --- |
| Background | #0B0F0E |
| Surface | #141A18 |
| Elevated | #1C2422 |
| Text | #ECF2EF |
| Muted text | #8A9792 |
| Border | #263230 |
| Accent (CTA, active nav) | #B6F36B |
| Accent 2 | #5EEAD4 |
| Credit | #6EE7A6 |
| Debit | #FB7185 |
| Bank card | gradient #1C2422 to #0B0F0E with #B6F36B glow |
| Fonts | Space Grotesk (headings), Geist or DM Sans (body), Geist Mono (numbers) |

### C. Pastel minimal

Off-white background, lilac and sage tints, soft 24 px radii, no shadows, big rounded chips. Friendly and approachable; good for the India-first statement import flow.

| Role | Hex |
| --- | --- |
| Background | #FAFAF7 |
| Surface | #FFFFFF |
| Text | #23222A |
| Muted text | #76737F |
| Border | #ECEAF2 |
| Accent (CTA, active nav) | #7C5CFF |
| Accent soft | #EEE9FF |
| Secondary tint | #DDEFE3 (sage) |
| Credit | #2E8B57 |
| Debit | #D64545 |
| Bank card | #7C5CFF to #B39CFF, or sage #8FBF9F |
| Fonts | Plus Jakarta Sans or Outfit (headings and body), Inter Tight only if a mono fallback is needed |

Whichever direction wins, give the doughnut 6 segment colours drawn from the accent family, and keep debit and credit as the only red and green on the page.

## Ready-to-paste Stitch prompt

Copy the block below, replace the palette lines with the direction you chose, and run it once per screen (Home first).

```
Design a web app called Horizon, a personal finance dashboard that shows every linked bank account, its balance and transactions, and lets the user transfer money between accounts. Banks connect via Plaid (US), Setu Account Aggregator (India) or an imported bank statement. Balances are shown per currency (USD and INR).

Screens, in order: Home (greeting, total balance box with a doughnut chart and one total per currency, recent transactions with a tab per bank, right sidebar with profile, bank cards and top spending categories), My Banks (grid of bank cards), Transaction History (bank selector, account header, full table with category chips), Payment Transfer (form: source bank, note, recipient email, recipient id, amount), Sign In, Sign Up, Connect Bank dialog (Plaid button, Setu button, statement upload).

Layout: fixed left sidebar with logo, five nav items with icons, connect-bank actions and a user footer with logout; a scrolling main column; the Home screen also has a fixed right sidebar at 1280 px and wider. Mobile uses a top bar and a slide-in menu. Home must fit one viewport with internal scrolling in the transactions area.

Style: DO NOT use the existing look, which is white cards on a #F3F9FF wash, a #0179FE to #4893FF blue gradient, Inter, and light grey shadows. Avoid blue as the primary colour and avoid gradient bank cards.

Use this palette instead:
- Background #F7F3EC, surface #FFFDF9, text #1B1A17, muted text #6B655C, border #E4DDD1
- Accent for buttons and active nav #C2410C, soft accent #FCE8DC
- Credit amounts #2F6F4E, debit amounts #B42318 (the only green and red on the page)
- Bank card: solid #1B1A17 with a #C2410C stripe, white text
- Doughnut: 6 segments from the accent family (#C2410C, #E0683B, #F0956A, #F7BFA3, #8C3A12, #5A2609)
- Fonts: Fraunces for headings, Manrope for body, JetBrains Mono for amounts

Components to include with real content: sidebar nav with active state, balance doughnut, bank card, transaction table rows with debit (tinted) and credit (tinted) examples, category chip, status chip, tabs, primary and ghost buttons, text input with label and inline error, select, dialog, loading skeleton. Use realistic sample data in INR (e.g. Rs 1,24,560.50, HDFC Bank ••4821) and USD (e.g. $110.00, Plaid Checking ••0000). Desktop 1440 px and mobile 390 px frames.
```

Swap the six palette lines for direction B or C from the section above if you prefer those. Ask Stitch for the design tokens as a list at the end so they can be pasted straight into `tailwind.config.ts`.
