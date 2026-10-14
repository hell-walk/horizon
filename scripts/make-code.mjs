// Makes a promo code (free days for whoever enters it on the Plans page).
// The admin portal will do this from a form later; until then, this script.
//
//   node scripts/make-code.mjs LAUNCH30 30                       # dry run
//   node scripts/make-code.mjs LAUNCH30 30 --apply               # 30 free days, unlimited uses
//   node scripts/make-code.mjs FRIENDS 14 --uses 50 --until 2026-12-31 --note "friends" --apply
//   node scripts/make-code.mjs LAUNCH30 --off --apply            # switch a code off
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client, Databases, ID, Query } = require("node-appwrite");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const apply = args.includes("--apply");
const off = args.includes("--off");
const [rawCode, daysText] = args.filter((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--") || ["--apply", "--off"].includes(args[i - 1])));
const code = String(rawCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const days = Number(daysText);
if (code.length < 4 || code.length > 32 || (!off && !(Number.isInteger(days) && days > 0 && days <= 3660))) {
  console.error("Usage: node scripts/make-code.mjs <CODE> <free days> [--uses N] [--until YYYY-MM-DD] [--note text] [--apply]   or   <CODE> --off --apply");
  process.exit(1);
}

const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const k of ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID", "APPWRITE_CODES_COLLECTION_ID"]) if (!env[k]) throw new Error(`${k} is missing from .env`);
const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
const DB = env.APPWRITE_DATABASE_ID, COL = env.APPWRITE_CODES_COLLECTION_ID;

const existing = (await db.listDocuments(DB, COL, [Query.equal("code", [code]), Query.limit(1)])).documents[0];
if (off) {
  if (!existing) throw new Error(`no code ${code}`);
  console.log(`${apply ? "Switching off" : "Dry run: would switch off"} ${code} (used ${existing.uses ?? 0} times).`);
  if (apply) await db.updateDocument(DB, COL, existing.$id, { active: false });
  process.exit(0);
}
if (existing) throw new Error(`${code} exists already (${existing.active === false ? "switched off" : "active"}, used ${existing.uses ?? 0} times).`);

const maxUses = Number(flag("--uses") ?? 0);
const until = flag("--until") ?? "";
if (until && Number.isNaN(Date.parse(until))) throw new Error("--until must be a date like 2026-12-31");
const row = { code, kind: "promo", ownerId: "", freeDays: days, maxUses, uses: 0, expiresAt: until ? new Date(until).toISOString() : "", active: true, note: (flag("--note") ?? "").slice(0, 200) };
console.log(`${apply ? "Creating" : "Dry run: would create"} ${code}: ${days} free days, ${maxUses ? `${maxUses} uses` : "unlimited uses"}${until ? `, until ${until}` : ""}.`);
if (apply) await db.createDocument(DB, COL, ID.unique(), row);
