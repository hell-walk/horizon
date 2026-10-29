// One-off, run by hand: adds the optional integer `seq` to the statement table
// (a row's place in its statement, so a day's rows keep the bank's order) and an
// index on bankId + date + seq for the reads that sort by it. Safe to run twice.
//
//   node scripts/add-row-order-field.mjs
//
// Then: npx tsx scripts/backfill-row-order.mts --apply   (gives existing rows their place)
import { existsSync, readFileSync } from "node:fs";

import { Client, Databases } from "node-appwrite";

const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
const DB = env.APPWRITE_DATABASE_ID;
const COL = env.APPWRITE_STATEMENT_COLLECTION_ID;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const attribute = async () => (await db.listAttributes(DB, COL)).attributes.find((a) => a.key === "seq");
if (!(await attribute())) {
  await db.createIntegerAttribute(DB, COL, "seq", false);
  console.log("seq: created");
} else console.log("seq: already there");
for (let i = 0; i < 60 && (await attribute())?.status !== "available"; i++) await wait(1000);
console.log("seq:", (await attribute())?.status);

const index = async () => (await db.listIndexes(DB, COL)).indexes.find((i) => i.key === "bank_date_seq");
if (!(await index())) {
  await db.createIndex(DB, COL, "bank_date_seq", "key", ["bankId", "date", "seq"], ["ASC", "ASC", "ASC"]);
  console.log("index bank_date_seq: created");
} else console.log("index bank_date_seq: already there");
for (let i = 0; i < 60 && (await index())?.status !== "available"; i++) await wait(1000);
console.log("index:", (await index())?.status);
