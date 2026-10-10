// Moves Horizon's existing logins from Appwrite to Supabase, keeping every
// profile, bank and statement where it is (Appwrite):
//   1. creates a Supabase login with the same email (already confirmed);
//   2. copies the settings stored on the Appwrite login (column layouts,
//      names and categories, goals, country) into the profile's `prefs`;
//   3. points the profile at the new login (profile.userId = Supabase id).
// Passwords cannot be copied (Appwrite never reveals them). The two security
// test accounts get theirs from HORIZON_TEST_EMAIL/_PASSWORD(_2) if set;
// everyone else signs in with Google (same email) or uses "Forgot password".
//
// Dry run by default; changes nothing without --apply. Safe to run again:
// a profile already pointing at a Supabase login is skipped. Emails are
// printed half-hidden.
//
//   node scripts/migrate-logins-to-supabase.mjs            # shows what it would do
//   node scripts/migrate-logins-to-supabase.mjs --apply    # does it
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { Client, Databases, Query, Users } from "node-appwrite";

const apply = process.argv.includes("--apply");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const need = ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID", "APPWRITE_USER_COLLECTION_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const k of need) if (!env[k]) throw new Error(`${k} is missing from .env`);

const appwrite = new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY);
const users = new Users(appwrite);
const database = new Databases(appwrite);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const hide = (email) => email.replace(/^(.)[^@]*(@.).*(\..*)$/, "$1***$2***$3");
const isSupabaseId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const knownPasswords = new Map(
  [
    [env.HORIZON_TEST_EMAIL, env.HORIZON_TEST_PASSWORD],
    [env.HORIZON_TEST_EMAIL_2, env.HORIZON_TEST_PASSWORD_2],
  ].filter(([email, password]) => email && password).map(([email, password]) => [email.toLowerCase(), password])
);

// Everything in Supabase already, by email (a re-run, or someone who used Google first).
const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`Supabase: ${error.message}`);
  for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
  if (data.users.length < 1000) break;
}

const profiles = (await database.listDocuments(env.APPWRITE_DATABASE_ID, env.APPWRITE_USER_COLLECTION_ID, [Query.limit(500)])).documents;
const logins = (await users.list([Query.limit(500)])).users;
const loginById = new Map(logins.map((u) => [u.$id, u]));

const parsePrefs = (text) => {
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

let done = 0;
let skipped = 0;
console.log(apply ? "Migrating:" : "Dry run. With --apply this would:");
for (const profile of profiles) {
  if (isSupabaseId(profile.userId)) {
    skipped++;
    continue; // already moved
  }
  const login = loginById.get(profile.userId);
  if (!login?.email) {
    console.log(`  - skip profile ${profile.$id}: no Appwrite login with an email (left as it is)`);
    skipped++;
    continue;
  }
  const email = login.email.toLowerCase();
  const password = knownPasswords.get(email);
  const settings = { ...(login.prefs ?? {}), ...parsePrefs(profile.prefs) };
  const settingNames = Object.keys(settings).join(", ") || "none";
  const plan = `${hide(email)}: ${existing.has(email) ? "reuse its Supabase login" : `new Supabase login (${password ? "test password from env" : "no password: Google or Forgot password"})`}; settings: ${settingNames}`;

  if (!apply) {
    console.log(`  - ${plan}`);
    continue;
  }

  let id = existing.get(email);
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: { full_name: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() },
    });
    if (error) throw new Error(`Supabase could not create ${hide(email)}: ${error.message}`);
    id = data.user.id;
    existing.set(email, id);
  }
  const text = JSON.stringify(settings);
  if (text.length > 100_000) throw new Error(`settings of ${hide(email)} are too large to move`);
  await database.updateDocument(env.APPWRITE_DATABASE_ID, env.APPWRITE_USER_COLLECTION_ID, profile.$id, { prefs: text, userId: id });
  console.log(`  - done: ${plan}`);
  done++;
}
console.log(apply ? `Moved ${done}, skipped ${skipped}.` : `${profiles.length - skipped} to move, ${skipped} to skip.`);
if (apply && done) console.log("The Appwrite logins are left in place (unused now). Delete them in the Appwrite console once everyone has signed in again.");
