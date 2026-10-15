// Creates the Appwrite table for promo and referral codes. No permissions:
// only the server (API key) reads or writes it; the admin portal will manage
// it later. Afterwards put the id in .env:
//   APPWRITE_CODES_COLLECTION_ID=codes
// Dry run by default; changes nothing without --apply. Safe to run twice.
//
//   node scripts/setup-codes.mjs            # shows what it would do
//   node scripts/setup-codes.mjs --apply    # does it
import { existsSync, readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const k of ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID"]) if (!env[k]) throw new Error(`${k} is missing from .env`);

const ID = "codes";
const base = `${env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/databases/${env.APPWRITE_DATABASE_ID}/collections`;
const headers = { "Content-Type": "application/json", "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT, "X-Appwrite-Key": env.NEXT_APPWRITE_KEY };
const call = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};

// One row per code. kind: "promo" (made by the team, for anyone) or "referral"
// (one per person, made when they first see it). ownerId is the referrer's
// login id for referral codes. freeDays is what redeeming gives; offerId is
// a Razorpay discount applied at checkout instead of, or as well as, days.
const FIELDS = [
  ["code", "string", { size: 32, required: true }],
  ["kind", "string", { size: 16, required: true }],
  ["ownerId", "string", { size: 64, required: false }],
  ["freeDays", "integer", { required: true, min: 0, max: 3660 }],
  ["maxUses", "integer", { required: false, min: 0, max: 1000000 }],
  ["uses", "integer", { required: false, min: 0, max: 1000000 }],
  ["expiresAt", "string", { size: 32, required: false }],
  ["active", "boolean", { required: false }],
  ["note", "string", { size: 200, required: false }],
  // A Razorpay offer (Dashboard -> Offers, for Subscriptions) applied when the
  // person subscribes, and the words shown to them, e.g. "50% off for 3 months".
  ["offerId", "string", { size: 64, required: false }],
  ["discountText", "string", { size: 120, required: false }],
];

const steps = [];
const existing = await call("GET", `/${ID}`);
const have = new Set(existing.ok ? (existing.json.attributes ?? []).map((a) => a.key) : []);
const indexes = new Set(existing.ok ? (existing.json.indexes ?? []).map((i) => i.key) : []);
if (!existing.ok) steps.push([`create the "${ID}" table (no permissions: server only)`, () => call("POST", "", { collectionId: ID, name: "Codes", permissions: [], documentSecurity: false })]);
for (const [key, type, options] of FIELDS) if (!have.has(key)) steps.push([`add \`${key}\``, () => call("POST", `/${ID}/attributes/${type}`, { key, ...options })]);
if (!indexes.has("code_unique")) {
  steps.push([
    "add a unique index on `code` (waits for the field to be ready)",
    async () => {
      for (let i = 0; i < 30; i++) {
        const c = await call("GET", `/${ID}`);
        if ((c.json.attributes ?? []).find((a) => a.key === "code")?.status === "available") break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return call("POST", `/${ID}/indexes`, { key: "code_unique", type: "unique", attributes: ["code"] });
    },
  ]);
}

if (steps.length === 0) {
  console.log(`Nothing to do: the "${ID}" table is ready. In .env: APPWRITE_CODES_COLLECTION_ID=${ID}`);
} else if (!apply) {
  console.log("Dry run. With --apply this would:");
  for (const [what] of steps) console.log(`  - ${what}`);
} else {
  for (const [what, run] of steps) {
    const result = await run();
    if (!result.ok) throw new Error(`${what}: ${result.status} ${result.json.message ?? ""}`);
    console.log(`Done: ${what}`);
  }
  console.log(`In .env: APPWRITE_CODES_COLLECTION_ID=${ID}`);
}
