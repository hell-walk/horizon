// Gives rows saved before `seq` existed their place in the bank's order, recovered
// from the balance column (src/lib/statements/rowOrder.ts). Rows that already have
// a seq are left alone; a day whose balances do not chain is left without one.
//
//   npx tsx scripts/backfill-row-order.mts            # dry run: what would change
//   npx tsx scripts/backfill-row-order.mts --apply    # writes seq
//
// Needs the Appwrite settings from .env.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { orderRows, type OrderRow } from "../src/lib/statements/rowOrder";

const require = createRequire(import.meta.url);
const { Client, Databases, Query } = require("node-appwrite");
const env: Record<string, string | undefined> = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const apply = process.argv.includes("--apply");
const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
const DB = env.APPWRITE_DATABASE_ID!;
const COL = env.APPWRITE_STATEMENT_COLLECTION_ID!;

type Doc = OrderRow & { bankId: string; seq: number | null };
const rows: Doc[] = [];
let cursor: string | undefined;
for (;;) {
  const page = await db.listDocuments(DB, COL, [Query.limit(500), Query.select(["$id", "bankId", "date", "amount", "type", "balance", "seq"]), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
  for (const d of page.documents) rows.push({ id: d.$id, bankId: d.bankId, date: String(d.date).slice(0, 10), amount: Number(d.amount), type: d.type, balance: d.balance == null ? null : Number(d.balance), seq: d.seq ?? null });
  if (page.documents.length < 500) break;
  cursor = page.documents[page.documents.length - 1].$id;
}
const banks = new Map<string, Doc[]>();
for (const r of rows) banks.set(r.bankId, [...(banks.get(r.bankId) ?? []), r]);

const updates: { id: string; seq: number }[] = [];
let skippedDays = 0, alreadySet = 0;
for (const [, list] of banks) {
  const todo = list.filter((r) => r.seq == null);
  alreadySet += list.length - todo.length;
  if (!todo.length) continue;
  const { ordered, incomplete } = orderRows(todo);
  skippedDays += incomplete.length;
  const bad = new Set(incomplete);
  // seq counts up through the whole account in the bank's order; a day that did not chain gets nothing.
  ordered.forEach((r, i) => {
    if (!bad.has(r.date)) updates.push({ id: r.id, seq: i });
  });
}
console.log(`${rows.length} rows in ${banks.size} accounts; ${alreadySet} already have a seq; ${updates.length} to set; ${skippedDays} days left without one (balances do not chain)`);
if (!apply) {
  console.log("Dry run. Add --apply to write.");
  process.exit(0);
}
let done = 0;
const queue = updates.slice();
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      await db.updateDocument(DB, COL, u.id, { seq: u.seq });
      if (++done % 500 === 0) console.log(`  ${done}/${updates.length}`);
    }
  }),
);
console.log(`wrote seq on ${done} rows`);
