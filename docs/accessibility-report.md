# Horizon accessibility report

**Date:** 10 October 2026 · **Tool:** axe-core 4.13 (WCAG 2.0/2.1/2.2 A and AA, plus best practices), run in the browser on every page, signed in, in light and dark mode, at desktop and phone (375 px) widths. Spot checks at 320 px and with the keyboard.

Automated checkers find roughly a third of real accessibility problems, so the keyboard, focus, motion and wording items below were checked by hand as well.

## Before and after

| Page | Before (light and dark alike) | After |
|---|---|---|
| Sign in | 10 low-contrast texts | 0 |
| Sign up | 29 low-contrast texts | 0 |
| Privacy / terms | 7 low-contrast texts | 0 |
| Home | 21 low contrast · 2 controls inside controls · 2 charts with no text · 1 scroll area unreachable by keyboard | 0 |
| My banks | 15 low contrast · 2 controls inside controls · 9 touch targets too small | 0 |
| Transaction history | 26 low contrast · 1 chart with no text · 1 unreachable scroll area | 0 |
| Payment transfer | **1 critical: account picker had no name** · 16 low contrast | 0 |
| Connect bank | 19 low contrast | 0 |

About 160 failing elements in 6 kinds before; none after, in both themes and at phone width. Each "after" run checked 47 rules across roughly 450 elements per page.

## What changed

**Low vision**
- Faint text has its own colour, at least 4.8:1 (light) and 4.5:1 (dark) on every surface; it used to share the border colour at about 4:1.
- Warning text has a readable shade (5.4:1 on its pale background, was 2.9:1).
- Small labels went from 11 px to 12 px; the two 9 px labels to 11 px; chips to 12 px.
- `tests/unit/contrast.test.ts` reads the colour tokens from the stylesheet and fails if any text colour drops below 4.5:1 on any surface, in either theme.
- Dark mode was already following the phone's own setting; the theme switch is now in the top bar on phones too (it was only inside the account menu), and on the legal pages. Narrow phones (under 400 px) show the compact logo so everything fits down to 320 px.

**Screen readers**
- Every chart has a spoken summary (for example "Spending by type: UPI payments ₹4,200, 42%; …").
- The account picker on the transfer page has a name.
- In the card deck, the cards behind the front one are single buttons; they used to contain a link, which screen readers announce confusingly.
- Each page has one main landmark, and the first thing on every page is a "Skip to main content" link.

**Keyboard**
- The bank tabs above the transaction lists were clickable boxes that a keyboard could not reach; they are real buttons now, and say which one is selected.
- Every link, button and control shows a focus ring when reached by keyboard (nothing extra on mouse clicks).
- Sideways-scrolling tables can be focused and scrolled with arrow keys.

**Touch**
- The deck's dots have 24 × 24 px tap areas (the dot itself is unchanged).

**Motion**
- With "reduce motion" switched on in the system settings, all animations and transitions stop, including chart entrances and the balance count-up.

## Not done yet (for people with less technical knowledge)

These need content and design decisions rather than fixes, and are the next step:

- Plain wording in place of the design's code-style labels ("Parsed // 2 transactions", "Method // 01", "Dr / Cr", "sharable id").
- A guided statement import: pick your bank, see how to download the statement and what its password usually is.
- Hindi (and later other languages).
- A confirmation screen before sending money, and short explanations next to money terms.
- A "Comfort" setting (larger text, high contrast).
