// What a leaked secret looks like, shared by scan-secrets.mjs (the whole
// history) and check-staged.mjs (the pre-commit check). Reports say where,
// never what.
import { existsSync, readFileSync } from "node:fs";

export const PATTERNS = [
  ["Appwrite API key", /\bstandard_[0-9a-f]{64,}\b/],
  ["Plaid access token", /\baccess-(development|production)-[0-9a-f-]{30,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Sentry auth token", /\bsntrys_[A-Za-z0-9_=-]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["Razorpay key", /\brzp_(test|live)_[A-Za-z0-9]{10,}/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ["Generic assignment", /\b(SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ENCRYPTION_KEY|TOKEN)\s*=\s*["']?[A-Za-z0-9+/=_.-]{16,}/],
];

// A Supabase service-role key is a JWT whose payload says "role":"service_role".
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;
export function serviceRoleJwt(text) {
  for (const m of text.matchAll(JWT)) {
    try {
      if (/"role"\s*:\s*"service_role"/.test(Buffer.from(m[1], "base64url").toString("utf8"))) return true;
    } catch {
      // not a JWT after all
    }
  }
  return false;
}

/** Secret values from .env, to search for verbatim (public ids and NEXT_PUBLIC_ values left out). */
export function envSecretValues(path = ".env") {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
    .filter(([name, value]) => /KEY|SECRET|PASSWORD|TOKEN/i.test(name) && !name.startsWith("NEXT_PUBLIC_") && value.length >= 12);
}

/** Files that should never be committed, whatever is inside. */
export const FORBIDDEN_FILES = [
  [/(^|\/)\.env($|\.(?!example$|sentry-build-plugin$))/, "an .env file"],
  [/api[_-]?keys?[^/]*\.(csv|json|txt)$/i, "a downloaded API-keys file"],
  [/credentials?[^/]*\.(csv|json|txt)$/i, "a downloaded credentials file"],
  [/service[_-]?account[^/]*\.json$/i, "a service-account key"],
  [/\.(pem|p12|pfx|key)$/i, "a private key file"],
];
