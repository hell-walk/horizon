// Looks for leaked secrets in the working tree and in every commit of the git
// history: well-known key formats, and the actual secret values from the local
// .env (so a key pasted into a file or a commit message is caught even when it
// has no recognisable shape). Prints where, never what.
//
//   node scripts/scan-secrets.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PATTERNS = [
  ["Appwrite API key", /\bstandard_[0-9a-f]{64,}\b/],
  ["Plaid access token", /\baccess-(development|production)-[0-9a-f-]{30,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Sentry auth token", /\bsntrys_[A-Za-z0-9_=-]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["Generic assignment", /\b(SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ENCRYPTION_KEY)\s*=\s*["']?[A-Za-z0-9+/=_-]{16,}/],
];

// Secret values from .env worth searching for verbatim (not ids that are public anyway).
const SECRET_NAMES = /KEY|SECRET|PASSWORD|TOKEN/i;
const envValues = existsSync(".env")
  ? readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
      .filter(([name, value]) => SECRET_NAMES.test(name) && !name.startsWith("NEXT_PUBLIC_") && value.length >= 12)
  : [];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const findings = [];
const warnings = [];
// Plaid sandbox tokens only work with the client id and secret that made them: worth knowing, not a leak.
const SANDBOX = /\baccess-sandbox-[0-9a-f-]{30,}/;
const check = (where, text) => {
  for (const [label, pattern] of PATTERNS) if (pattern.test(text)) findings.push(`${where}: looks like a ${label}`);
  for (const [name, value] of envValues) if (text.includes(value)) findings.push(`${where}: contains the value of ${name} from .env`);
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
