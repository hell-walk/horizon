This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project structure

Each page lives in its own bracket folder (a route group: the brackets keep it
out of the URL) together with the components and UI pieces only it uses.
Anything used in two or more places stays in `src/components`.

```
src/
  app/
    (root)/                    signed-in app: layout (navbar, top bar, sign-in check) and loading state
      components/  ui/         the app frame: navbar, top bar, bottom bar, account menu
      (home)/                  /                      overview, charts, right sidebar
      (my-banks)/              /my-banks              card deck, card designs
      (transaction-history)/   /transaction-history   payees, UPI breakdown
      (payment-transfer)/      /payment-transfer      transfer form
      (connect-bank)/          /connect-bank, /setu/callback
    (auth)/                    /sign-in, /sign-up     auth form and its inputs
    (legal)/                   /privacy, /terms
  components/                  shared components (cards, tables, statement import, Plaid/Setu links)
  components/ui/               shared UI primitives (form, input, label, toggles)
  constants/                   shared constants
  lib/
    actions/                   server actions: the only functions the browser can call
    server/                    server-only data access, auth, encryption, rate limits
    providers/                 Plaid, Setu and statement-import adapters
    statements/                statement file parsing
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
