// Reads the nightly backups back from R2 (see src/lib/server/backup.ts), the
// proof that they can be restored:
//
//   node scripts/restore-backup.mjs list                      # every backup in the bucket, newest first
//   node scripts/restore-backup.mjs fetch [key] [out.json]    # download + decrypt one (the newest by default), write it as JSON, summarise
//   node scripts/restore-backup.mjs restore <file.json>       # dry run: which rows are missing from Appwrite
//   node scripts/restore-backup.mjs restore <file.json> --apply   # put the missing rows back (ids kept; existing rows untouched)
//
// Logins (Supabase) are listed in the file but not re-created here: Supabase
// cannot take password hashes back, so a lost login is re-made from the admin
// portal and the person resets their password. Needs R2_* and BACKUP_KEY in .env
// (and the Appwrite keys for restore).
import { createDecipheriv, createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const need = (names) => {
  for (const n of names) if (!env[n]) throw new Error(`Missing ${n} (put it in .env)`);
};

// --- R2, signed by hand (the same as src/lib/server/r2.ts) ---
const sha256 = (d) => createHash("sha256").update(d).digest("hex");
const hmac = (k, d) => createHmac("sha256", k).update(d).digest();
const encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
async function r2(method, path, query = {}, body) {
  need(["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]);
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");
  const uri = `/${env.R2_BUCKET}${path ? `/${path.split("/").map(encode).join("/")}` : ""}`;
  const qs = Object.keys(query).sort().map((k) => `${encode(k)}=${encode(query[k])}`).join("&");
  const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = Object.keys(headers).sort().join(";");
  const canonical = [method, uri, qs, Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join(""), signed, payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  const res = await fetch(`https://${host}${uri}${qs ? `?${qs}` : ""}`, {
    method,
    headers: { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}` },
    body,
  });
  if (!res.ok) throw new Error(`R2 ${method} ${path || "(bucket)"}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}
const list = async () => {
  const xml = await (await r2("GET", "", { "list-type": "2", prefix: "backups/" })).text();
  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
    .map((m) => ({ key: m[1].match(/<Key>([^<]*)<\/Key>/)?.[1], at: m[1].match(/<LastModified>([^<]*)<\/LastModified>/)?.[1], size: Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0) }))
    .filter((o) => o.key)
    .sort((a, b) => b.at.localeCompare(a.at));
};

const open = (file) => {
  need(["BACKUP_KEY"]);
  if (file.subarray(0, 4).toString() !== "HZB1") throw new Error("not a Horizon backup file");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(env.BACKUP_KEY, "hex"), file.subarray(4, 16));
  decipher.setAuthTag(file.subarray(16, 32));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(file.subarray(32)), decipher.final()])).toString());
};
const summarise = (b) => {
  console.log(`taken ${b.takenAt}: ${b.logins.length} logins`);
  for (const [id, c] of Object.entries(b.collections)) console.log(`  ${c.name.padEnd(20)} ${String(c.documents.length).padStart(6)} rows  (${id})`);
};

const [cmd, a, b] = process.argv.slice(2).filter((x) => x !== "--apply");
const apply = process.argv.includes("--apply");
if (cmd === "list") {
  for (const o of await list()) console.log(`${o.at}  ${String(o.size).padStart(9)}  ${o.key}`);
} else if (cmd === "fetch") {
  const key = a || (await list())[0]?.key; // "" means the newest, so an output path can be given alone
  if (!key) throw new Error("no backups in the bucket yet");
  const backup = open(Buffer.from(await (await r2("GET", key)).arrayBuffer()));
  const out = b ?? key.split("/").pop().replace(/\.gz\.enc$/, "");
  writeFileSync(out, JSON.stringify(backup, null, 1));
  console.log(`wrote ${out}`);
  summarise(backup);
} else if (cmd === "restore") {
  if (!a) throw new Error("restore needs the JSON file from fetch");
  need(["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID"]);
  const { Client, Databases, Query } = require("node-appwrite");
  const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
  const backup = JSON.parse(readFileSync(a, "utf8"));
  summarise(backup);
  let missing = 0, restored = 0;
  for (const [id, c] of Object.entries(backup.collections)) {
    // What is there now, by id.
    const present = new Set();
    let cursor;
    for (;;) {
      const page = await db.listDocuments(env.APPWRITE_DATABASE_ID, id, [Query.limit(100), Query.select(["$id"]), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
      for (const d of page.documents) present.add(d.$id);
      if (page.documents.length < 100) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
    const gone = c.documents.filter((d) => !present.has(d.$id));
    if (gone.length) console.log(`  ${c.name}: ${gone.length} rows missing`);
    missing += gone.length;
    if (!apply) continue;
    for (const d of gone) {
      const data = Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith("$")));
      await db.createDocument(env.APPWRITE_DATABASE_ID, id, d.$id, data, d.$permissions ?? []);
      restored++;
    }
  }
  console.log(apply ? `restored ${restored} of ${missing} missing rows` : `${missing} rows missing; add --apply to put them back`);
} else {
  console.error("Usage: node scripts/restore-backup.mjs list | fetch [key] [out.json] | restore <file.json> [--apply]");
  process.exit(1);
}
