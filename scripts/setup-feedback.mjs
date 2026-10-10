// Creates the Appwrite table that keeps what people send from the feedback
// form. No permissions: only the server (API key) can read or write it, and
// the admin portal will list it later. Afterwards put the printed id in .env:
//   APPWRITE_FEEDBACK_COLLECTION_ID=feedback
// Dry run by default; changes nothing without --apply. Safe to run twice.
//
//   node scripts/setup-feedback.mjs            # shows what it would do
//   node scripts/setup-feedback.mjs --apply    # does it
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

const ID = "feedback";
const base = `${env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/databases/${env.APPWRITE_DATABASE_ID}/collections`;
const headers = { "Content-Type": "application/json", "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT, "X-Appwrite-Key": env.NEXT_APPWRITE_KEY };
const call = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};

// What is kept: whose it is (profile id), what kind, the message, the page it
// was sent from, the language, and an email only if they said "you may reply".
const FIELDS = [
  ["ownerId", "string", { size: 64, required: true }],
  ["kind", "string", { size: 16, required: true }],
  ["message", "string", { size: 2000, required: true }],
  ["page", "string", { size: 200, required: false }],
  ["locale", "string", { size: 8, required: false }],
  ["replyTo", "string", { size: 254, required: false }],
];

const steps = [];
const existing = await call("GET", `/${ID}`);
const have = new Set(existing.ok ? (existing.json.attributes ?? []).map((a) => a.key) : []);
if (!existing.ok) {
  steps.push([`create the "${ID}" table (no permissions: server only)`, () => call("POST", "", { collectionId: ID, name: "Feedback", permissions: [], documentSecurity: false })]);
}
for (const [key, type, options] of FIELDS) {
  if (!have.has(key)) steps.push([`add \`${key}\``, () => call("POST", `/${ID}/attributes/${type}`, { key, ...options })]);
}

if (steps.length === 0) {
  console.log(`Nothing to do: the "${ID}" table is ready. In .env: APPWRITE_FEEDBACK_COLLECTION_ID=${ID}`);
} else if (!apply) {
  console.log("Dry run. With --apply this would:");
  for (const [what] of steps) console.log(`  - ${what}`);
} else {
  for (const [what, run] of steps) {
    const result = await run();
    if (!result.ok) throw new Error(`${what}: ${result.status} ${result.json.message ?? ""}`);
    console.log(`Done: ${what}`);
  }
  console.log(`Appwrite builds new fields in the background (a few seconds). In .env: APPWRITE_FEEDBACK_COLLECTION_ID=${ID}`);
}
