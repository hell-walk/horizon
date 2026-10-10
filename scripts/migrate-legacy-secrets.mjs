// One-time migration for data written before encryption existed:
//   - bank access tokens stored as plain text  -> sealed (AES-256-GCM, same format as the app)
//   - SSN and date of birth on old profiles     -> "not-kept" (the app no longer stores them)
//   - optionally, old sharable ids (base64 of the account id) -> random ids (--rotate-sharable-ids;
//     any id already shared with someone stops working)
//
//   node scripts/migrate-legacy-secrets.mjs                 dry run: counts only, changes nothing
//   node scripts/migrate-legacy-secrets.mjs --apply         migrate, after writing an encrypted backup
//
// The backup (reports/legacy-backup-<time>.sealed) holds the original values sealed with
// DATA_ENCRYPTION_KEY, so a rollback is possible without leaving plain text on disk.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client, Databases, Query } = require("node-appwrite");

const apply = process.argv.includes("--apply");
const rotateSharable = process.argv.includes("--rotate-sharable-ids");

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const key = Buffer.from(env.DATA_ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32) {
  console.error("DATA_ENCRYPTION_KEY (32 bytes, base64) must be set in .env");
  process.exit(1);
}

const PREFIX = "enc:v1:";
const seal = (plain) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
};
const open = (value) => {
  const data = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
};

const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
const DB = env.APPWRITE_DATABASE_ID;

async function all(collection, select) {
  const out = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100), Query.select(["$id", ...select])];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await db.listDocuments(DB, collection, queries);
    out.push(...page.documents);
    if (page.documents.length < 100) return out;
    cursor = page.documents.at(-1).$id;
  }
}

const banks = await all(env.APPWRITE_BANK_COLLECTION_ID, ["accessToken", "sharableId", "accountId", "provider"]);
const profiles = await all(env.APPWRITE_USER_COLLECTION_ID, ["ssn", "dateOfBirth"]);

const plainTokens = banks.filter((b) => b.accessToken && !b.accessToken.startsWith(PREFIX));
const oldSharable = banks.filter((b) => {
  try {
    return Buffer.from(b.sharableId, "base64").toString() === b.accountId;
  } catch {
    return false;
  }
});
const keptPii = profiles.filter((p) => (p.ssn && p.ssn !== "not-kept") || (p.dateOfBirth && p.dateOfBirth !== "not-kept"));

console.log(`Banks: ${banks.length} · plain-text access tokens: ${plainTokens.length} · old-style sharable ids: ${oldSharable.length}`);
console.log(`Profiles: ${profiles.length} · still holding SSN or date of birth: ${keptPii.length}`);

if (!apply) {
  console.log("\nDry run: nothing changed. Run with --apply to migrate (add --rotate-sharable-ids to replace old sharable ids).");
  process.exit(0);
}

// Backup first, sealed, so a rollback needs the same key and nothing sits in plain text.
mkdirSync("reports", { recursive: true });
const backup = {
  at: new Date().toISOString(),
  banks: plainTokens.map((b) => ({ id: b.$id, accessToken: b.accessToken, sharableId: b.sharableId })),
  profiles: keptPii.map((p) => ({ id: p.$id, ssn: p.ssn, dateOfBirth: p.dateOfBirth })),
};
const backupFile = `reports/legacy-backup-${Date.now()}.sealed`;
writeFileSync(backupFile, seal(JSON.stringify(backup)));
if (JSON.parse(open(readFileSync(backupFile, "utf8"))).banks.length !== backup.banks.length) throw new Error("Backup did not verify");
console.log(`Backup written and verified: ${backupFile}`);

for (const b of plainTokens) {
  await db.updateDocument(DB, env.APPWRITE_BANK_COLLECTION_ID, b.$id, { accessToken: seal(b.accessToken) });
}
if (rotateSharable) {
  for (const b of oldSharable) await db.updateDocument(DB, env.APPWRITE_BANK_COLLECTION_ID, b.$id, { sharableId: randomBytes(18).toString("base64url") });
}
for (const p of keptPii) {
  await db.updateDocument(DB, env.APPWRITE_USER_COLLECTION_ID, p.$id, { ssn: "not-kept", dateOfBirth: "not-kept" });
}

// Verify: every token sealed and opening to the original.
const after = await all(env.APPWRITE_BANK_COLLECTION_ID, ["accessToken"]);
const original = new Map(plainTokens.map((b) => [b.$id, b.accessToken]));
const bad = after.filter((b) => b.accessToken && (!b.accessToken.startsWith(PREFIX) || (original.has(b.$id) && open(b.accessToken) !== original.get(b.$id))));
const pii = (await all(env.APPWRITE_USER_COLLECTION_ID, ["ssn", "dateOfBirth"])).filter((p) => p.ssn !== "not-kept" || p.dateOfBirth !== "not-kept");
console.log(`Verified: ${after.length - bad.length}/${after.length} tokens sealed correctly; ${pii.length} profiles still holding SSN/DOB.`);
if (bad.length || pii.length) process.exit(1);
console.log("Migration complete.");
