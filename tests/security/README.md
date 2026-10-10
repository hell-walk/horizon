# Security tests

Black-box tests that attack a running Horizon the way an outsider would: raw
HTTP requests, server actions called by id, forged headers and session tokens,
hostile files, unsigned or oversized webhooks, and a second account trying to
reach the first one's data through every public action (the authorization grid).

They run against a **production build on your own machine** (or the staging
workflow, below), never against the live site.

## Run locally

```bash
npm run build
npx next start -p 3100
```

In another terminal, with two throwaway accounts (never real ones). Each needs a
profile, and the trial's daily limit would get in the way, so give both free
access first (`node scripts/grant-plan.mjs <email> 365 --apply`):

```bash
HORIZON_TEST_EMAIL=a@example.com HORIZON_TEST_PASSWORD=... \
HORIZON_TEST_EMAIL_2=b@example.com HORIZON_TEST_PASSWORD_2=... \
npm run test:security
```

- The run fails if anything is skipped or fewer tests ran than `MIN_TESTS` in
  `scripts/run-security-tests.mjs` (125 at the moment). `HORIZON_SECURITY_ALLOW_SKIP=1`
  relaxes that for local poking only.
- `HORIZON_URL` points somewhere else than `http://localhost:3100`.
- Behind a real proxy, set `HORIZON_BEHIND_PROXY=1` to add the forged-`X-Forwarded-Host` check.
- The tests read server action ids from `.next/server/server-reference-manifest.json`,
  so the build must be the one the server is running.
- They write a little data to the two test accounts, and the deletion test makes
  (and deletes) a throwaway login with the Supabase service key from `.env`.
- Rate limits are real and kept in Redis: the runner clears the development ones
  (prefix ending in `-dev`) before each run.

## On GitHub

- `.github/workflows/ci.yml` runs on every push: lint, TypeScript, the unit
  tests and a production build. No secrets needed.
- `.github/workflows/security.yml` runs this suite on demand (Actions -> Security
  tests -> Run workflow) against **staging services with disposable
  credentials**, never production ones. It needs these repository secrets:
  `STAGING_ENV_FILE` (the whole `.env` of a staging setup, with `REDIS_PREFIX`
  ending in `-dev`), `HORIZON_TEST_EMAIL`, `HORIZON_TEST_PASSWORD`,
  `HORIZON_TEST_EMAIL_2`, `HORIZON_TEST_PASSWORD_2`.
