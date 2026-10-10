// The pre-commit check: refuses a commit that would publish a secret. Looks at
// exactly what is staged: key files by name (downloaded API-key CSVs, .env,
// private keys), known key formats, and the secret values from the local .env.
// Prints where, never what. Installed by scripts/install-hooks.mjs.
//
//   node scripts/check-staged.mjs     (git runs it before every commit)
import { execFileSync } from "node:child_process";

import { envSecretValues, FORBIDDEN_FILES, PATTERNS, serviceRoleJwt } from "./secret-patterns.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean);
const secrets = envSecretValues();
const problems = [];

for (const file of staged) {
  const forbidden = FORBIDDEN_FILES.find(([pattern]) => pattern.test(file));
  if (forbidden) {
    problems.push(`${file}: looks like ${forbidden[1]}`);
    continue;
  }
  if (/\.(png|jpe?g|gif|ico|webp|avif|pdf|xlsx?|zip|woff2?)$/i.test(file)) continue;
  const text = git("show", `:${file}`);
  for (const [label, pattern] of PATTERNS) if (pattern.test(text)) problems.push(`${file}: looks like a ${label}`);
  if (serviceRoleJwt(text)) problems.push(`${file}: contains a Supabase service-role key`);
  for (const [name, value] of secrets) if (text.includes(value)) problems.push(`${file}: contains the value of ${name} from .env`);
}

if (problems.length) {
  console.error(`\nCommit stopped: it would publish ${problems.length === 1 ? "a secret" : "secrets"}.\n  ${[...new Set(problems)].join("\n  ")}`);
  console.error("\nUnstage it (git restore --staged <file>), move key files out of the project, and commit again.\n");
  process.exit(1);
}
