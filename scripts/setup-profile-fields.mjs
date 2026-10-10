// Prepares the Appwrite profile collection for Supabase sign-in:
//   1. adds `prefs` (column layouts, names and categories, goals, country), which
//      used to live on the Appwrite login, a login that Supabase replaces;
//   2. makes `state` and `postalCode` optional: since sign-up asks only what
//      each country needs, someone in the UK or the UAE may have neither.
// Dry run by default; changes nothing without --apply. Safe to run twice.
//
//   node scripts/setup-profile-fields.mjs            # shows what it would do
//   node scripts/setup-profile-fields.mjs --apply    # does it
import { existsSync, readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const need = ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID", "APPWRITE_USER_COLLECTION_ID"];
for (const k of need) if (!env[k]) throw new Error(`${k} is missing from .env`);

const base = `${env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_USER_COLLECTION_ID}`;
const headers = { "Content-Type": "application/json", "X-Appwrite-Project": env.NEXT_PUBLIC_APPWRITE_PROJECT, "X-Appwrite-Key": env.NEXT_APPWRITE_KEY };
const call = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json.message ?? ""}`);
  return json;
};

const collection = await call("GET", "");
const attributes = new Map((collection.attributes ?? []).map((a) => [a.key, a]));
const steps = [];

if (!attributes.has("prefs")) {
  steps.push(["add `prefs` (text, up to 100,000 characters, optional)", () => call("POST", "/attributes/string", { key: "prefs", size: 100000, required: false })]);
}
for (const key of ["state", "postalCode"]) {
  const a = attributes.get(key);
  if (a?.required) {
    steps.push([`make \`${key}\` optional`, () => call("PATCH", `/attributes/string/${key}`, { required: false, default: null })]);
  }
}

if (steps.length === 0) {
  console.log("Nothing to do: the profile collection is ready.");
} else if (!apply) {
  console.log("Dry run. With --apply this would:");
  for (const [what] of steps) console.log(`  - ${what}`);
} else {
  for (const [what, run] of steps) {
    await run();
    console.log(`Done: ${what}`);
  }
  console.log("Appwrite builds new fields in the background; give it a few seconds before using `prefs`.");
}
