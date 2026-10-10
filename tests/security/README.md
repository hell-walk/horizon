# Security tests

Black-box tests that attack a running Horizon the way an outsider would: raw
HTTP requests, server actions called by id, forged headers, hostile files, a
second account trying to reach the first one's data, and direct calls to
Appwrite with a user's own session.

They run against a **production build on your own machine**, never against a
deployed site.

## Run

```bash
npm run build
npx next start -p 3100
```

In another terminal, with two throwaway accounts (never real ones):

```bash
HORIZON_TEST_EMAIL=a@example.com HORIZON_TEST_PASSWORD=... \
HORIZON_TEST_EMAIL_2=b@example.com HORIZON_TEST_PASSWORD_2=... \
npm run test:security
```

- `HORIZON_URL` points somewhere else than `http://localhost:3100`.
- Without the account variables the run fails (with `HORIZON_SECURITY_ALLOW_SKIP=1`, only the anonymous tests run).
- `npm run test:security` fails if anything is skipped or fewer than 84 tests ran; `HORIZON_SECURITY_ALLOW_SKIP=1` relaxes that for local poking.
- Behind a real proxy (staging), set `HORIZON_BEHIND_PROXY=1` to add the forged-`X-Forwarded-Host` check.
- The tests read server action ids from `.next/server/server-reference-manifest.json`,
  so the build must be the one the server is running.
- They write a little data to the two test accounts (a "Victim Test Bank" for
  account B, a few test statements for account A). Use accounts made for this.
- Rate limits are real: running the suite several times within 10 minutes can
  hit the statement-reading limit (30 per user). Restart the server to reset.
