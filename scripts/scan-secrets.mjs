// Looks for leaked secrets in the working tree and in every commit of the git
// history: well-known key formats, and the actual secret values from the local
// .env (so a key pasted into a file or a commit message is caught even when it
// has no recognisable shape). Prints where, never what.
//
//   node scripts/scan-secrets.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { envSecretValues, PATTERNS, serviceRoleJwt } from "./secret-patterns.mjs";

const envValues = envSecretValues();

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const findings = [];
const warnings = [];
// Plaid sandbox tokens only work with the client id and secret that made them: worth knowing, not a leak.
const SANDBOX = /\baccess-sandbox-[0-9a-f-]{30,}/;
const check = (where, text) => {
  for (const [label, pattern] of PATTERNS) if (pattern.test(text)) findings.push(`${where}: looks like a ${label}`);
  for (const [name, value] of envValues) if (text.includes(value)) findings.push(`${where}: contains the value of ${name} from .env`);
  if (serviceRoleJwt(text)) findings.push(`${where}: contains a Supabase service-role key`);
  if (SANDBOX.test(text)) warnings.push(`${where}: Plaid sandbox access token (sample data)`);
};

// 1. Tracked files as they are now (env.example is allowed to name variables, not to hold values).
for (const file of git("ls-files").split("\n").filter(Boolean)) {
  if (/\.(png|jpe?g|gif|ico|webp|avif|pdf|xlsx?|zip|woff2?)$/i.test(file) || !existsSync(file)) continue;
  check(file, readFileSync(file, "utf8"));
}

// 2. Every commit in every branch: the patch and the message.
const commits = git("rev-list", "--all").split("\n").filter(Boolean);
for (const sha of commits) check(`commit ${sha.slice(0, 8)}`, git("show", "--no-color", "--format=%B", sha));

const unique = [...new Set(findings)];
for (const warning of new Set(warnings)) console.log(`warning: ${warning}`);
console.log(`Scanned ${git("ls-files").split("\n").filter(Boolean).length} tracked files and ${commits.length} commits; ${envValues.length} .env secret values checked verbatim.`);
if (unique.length) {
  console.log(`${unique.length} possible secret(s):\n  ${unique.join("\n  ")}`);
  process.exit(1);
}
console.log("No secrets found.");
