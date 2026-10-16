// Removes whole accounts by hand (test logins, or on request), the same way
// "Delete my account" does: each bank with its statement rows, the person's
// side of transfer records (anonymised; the other person keeps their history),
// their feedback and referral code, the Supabase login (ending every session),
// then the profile row. A login with no profile is removed on its own.
//
//   node scripts/remove-accounts.mjs <profile id | email> ...            # shows what it would remove
//   node scripts/remove-accounts.mjs <profile id | email> ... --apply    # removes it, for good
//
// Needs the Appwrite and Supabase admin settings from .env. Plaid items and
// Dwolla funding sources are not touched (sandbox only so far); say so if a
// target has any.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client, Databases, Query } = require("node-appwrite");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const targets = args.filter((a) => !a.startsWith("--"));
if (!targets.length) {
  console.error("Usage: node scripts/remove-accounts.mjs <profile id | email> ... [--apply]");
  process.exit(1);
}
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const DB = env.APPWRITE_DATABASE_ID;
const T = {
  users: env.APPWRITE_USER_COLLECTION_ID,
  banks: env.APPWRITE_BANK_COLLECTION_ID,
  transfers: env.APPWRITE_TRANSACTION_COLLECTION_ID,
  statements: env.APPWRITE_STATEMENT_COLLECTION_ID,
  feedback: env.APPWRITE_FEEDBACK_COLLECTION_ID,
  codes: env.APPWRITE_CODES_COLLECTION_ID,
};
const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const DELETED_USER = "deleted-user";

async function listAll(table, queries) {
  if (!table) return [];
  const rows = [];
  let cursor;
  for (;;) {
    const page = await db.listDocuments(DB, table, [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    rows.push(...page.documents);
    if (page.documents.length < 100) return rows;
    cursor = page.documents.at(-1).$id;
  }
}
async function allLogins() {
  const users = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Supabase: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
  return users;
}

const logins = await allLogins();
let problems = 0;
for (const target of targets) {
  const byEmail = target.includes("@");
  const profile = byEmail
    ? (await db.listDocuments(DB, T.users, [Query.equal("email", [target.toLowerCase()]), Query.limit(1)])).documents[0]
    : await db.getDocument(DB, T.users, target).catch(() => null);
  const login = profile ? logins.find((u) => u.id === profile.userId) : logins.find((u) => u.email?.toLowerCase() === target.toLowerCase());
  if (!profile && !login) {
    console.log(`${target}: nothing found`);
    problems++;
    continue;
  }
  const owner = profile?.$id;
  const banks = owner ? await listAll(T.banks, [Query.equal("userId", [owner])]) : [];
  const statementCounts = await Promise.all(banks.map((b) => listAll(T.statements, [Query.equal("bankId", [b.$id])])));
  const sent = owner ? await listAll(T.transfers, [Query.equal("senderId", [owner])]) : [];
  const received = owner ? await listAll(T.transfers, [Query.equal("receiverId", [owner])]) : [];
  const feedback = owner ? await listAll(T.feedback, [Query.equal("ownerId", [owner])]).catch(() => []) : [];
  const codes = login ? await listAll(T.codes, [Query.equal("ownerId", [login.id])]).catch(() => []) : [];
  const linked = banks.filter((b) => (b.accessToken && !String(b.accessToken).includes("manual")) || b.fundingSourceUrl);

  const who = `${profile?.email ?? login?.email} (${profile ? `profile ${profile.$id}` : "no profile"}, ${login ? `login ${login.id.slice(0, 8)}` : "no login"})`;
  console.log(
    `${apply ? "Removing" : "Would remove"} ${who}: ${banks.length} bank(s) with ${statementCounts.reduce((s, r) => s + r.length, 0)} statement rows, ` +
      `${sent.length + received.length} transfer record(s) anonymised, ${feedback.length} feedback, ${codes.length} referral code(s)` +
      (linked.length ? `; NOTE ${linked.length} bank(s) had a Plaid/Dwolla link, not cut here` : ""),
  );
  if (!apply) continue;

  try {
    for (const [i, bank] of banks.entries()) {
      for (const row of statementCounts[i]) await db.deleteDocument(DB, T.statements, row.$id);
      await db.deleteDocument(DB, T.banks, bank.$id);
    }
    for (const t of sent) await db.updateDocument(DB, T.transfers, t.$id, { senderId: DELETED_USER });
    for (const t of received) await db.updateDocument(DB, T.transfers, t.$id, { receiverId: DELETED_USER, email: DELETED_USER });
    for (const f of feedback) await db.deleteDocument(DB, T.feedback, f.$id);
    for (const c of codes) await db.deleteDocument(DB, T.codes, c.$id);
    if (login) {
      const { error } = await supabase.auth.admin.deleteUser(login.id);
      if (error && error.status !== 404) throw new Error(`login: ${error.message}`);
    }
    if (profile) await db.deleteDocument(DB, T.users, profile.$id);
    console.log("  done");
  } catch (error) {
    problems++;
    console.error(`  stopped: ${error.message} (safe to run again)`);
  }
}
if (!apply) console.log("Dry run: nothing changed. Add --apply to remove.");
process.exit(problems ? 1 : 0);
