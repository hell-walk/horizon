import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { Query } from "node-appwrite";

import { createAdminClient } from "./appwrite";
import { r2Delete, r2List, r2Put, type R2Object } from "./r2";
import { createSupabaseAdmin } from "./supabase";

// The nightly backup: every Appwrite table (found live, so a table added
// later is never missed) and every Supabase login, as one gzipped JSON file,
// encrypted with BACKUP_KEY (AES-256-GCM; the key lives only in the env, never
// in the bucket), uploaded to R2 under backups/, and copies older than KEEP_DAYS
// removed. scripts/restore-backup.mjs reads them back.

export const BACKUP_PREFIX = "backups/";
export const KEEP_DAYS = 30;
const MAGIC = Buffer.from("HZB1");
const PAGE = 100;

export type Backup = {
  takenAt: string;
  collections: Record<string, { name: string; documents: Record<string, unknown>[] }>;
  logins: Record<string, unknown>[];
};
export type BackupStats = { key: string; bytes: number; collections: number; documents: number; logins: number; pruned: string[] };

const keyFromEnv = () => {
  const hex = process.env.BACKUP_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("BACKUP_KEY must be 64 hex characters (32 bytes): node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  return Buffer.from(hex, "hex");
};

/** gzip, then AES-256-GCM: magic + iv (12) + tag (16) + ciphertext. */
export function sealBackup(backup: Backup, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = gzipSync(Buffer.from(JSON.stringify(backup)));
  const sealed = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), sealed]);
}

export function openBackup(file: Buffer, key: Buffer): Backup {
  if (!file.subarray(0, 4).equals(MAGIC)) throw new Error("not a Horizon backup file");
  const iv = file.subarray(4, 16);
  const tag = file.subarray(16, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(file.subarray(32)), decipher.final()]);
  return JSON.parse(gunzipSync(plain).toString()) as Backup;
}

/** The copies to remove: older than `days`, never the newest one whatever its age. */
export function staleBackups(objects: R2Object[], days: number, now = new Date()): string[] {
  const sorted = objects.slice().sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  const cutoff = now.getTime() - days * 86_400_000;
  return sorted.slice(1).filter((o) => Date.parse(o.lastModified) < cutoff).map((o) => o.key);
}

async function dumpCollections(): Promise<Backup["collections"]> {
  const { database } = await createAdminClient();
  const db = process.env.APPWRITE_DATABASE_ID!;
  const out: Backup["collections"] = {};
  const { collections } = await database.listCollections(db, [Query.limit(100)]);
  for (const c of collections) {
    const documents: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await database.listDocuments(db, c.$id, [Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
      documents.push(...(page.documents as Record<string, unknown>[]));
      if (page.documents.length < PAGE) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
    out[c.$id] = { name: c.name, documents };
  }
  return out;
}

async function dumpLogins(): Promise<Record<string, unknown>[]> {
  const admin = createSupabaseAdmin();
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...(data.users as unknown as Record<string, unknown>[]));
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Takes the backup, uploads it, prunes the old ones, and says what it did. */
export async function runBackup(now = new Date()): Promise<BackupStats> {
  const key = keyFromEnv();
  const [collections, logins] = await Promise.all([dumpCollections(), dumpLogins()]);
  const backup: Backup = { takenAt: now.toISOString(), collections, logins };
  const file = sealBackup(backup, key);
  const name = `${BACKUP_PREFIX}horizon-${now.toISOString().replace(/[:.]/g, "-")}.json.gz.enc`;
  await r2Put(name, file);
  const pruned = staleBackups(await r2List(BACKUP_PREFIX), KEEP_DAYS, now);
  for (const old of pruned) await r2Delete(old);
  return {
    key: name,
    bytes: file.length,
    collections: Object.keys(collections).length,
    documents: Object.values(collections).reduce((n, c) => n + c.documents.length, 0),
    logins: logins.length,
    pruned,
  };
}
