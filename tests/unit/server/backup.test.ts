import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { openBackup, sealBackup, staleBackups, type Backup } from "@/lib/server/backup";
import { parseListing } from "@/lib/server/r2";

const sample: Backup = {
  takenAt: "2026-10-27T02:00:00.000Z",
  collections: { users: { name: "users", documents: [{ $id: "u1", firstName: "Ada", prefs: "{}" }] }, banks: { name: "banks", documents: [] } },
  logins: [{ id: "auth-1", email: "ada@example.com" }],
};

describe("backup file", () => {
  it("seals and opens again with the key, and with no other", () => {
    const key = randomBytes(32);
    const file = sealBackup(sample, key);
    expect(file.subarray(0, 4).toString()).toBe("HZB1");
    expect(file.toString("latin1")).not.toContain("ada@example.com"); // encrypted, and compressed before that
    expect(openBackup(file, key)).toEqual(sample);
    expect(() => openBackup(file, randomBytes(32))).toThrow();
    // A flipped byte in the body fails the integrity check instead of returning garbage.
    const tampered = Buffer.from(file);
    tampered[tampered.length - 1] ^= 1;
    expect(() => openBackup(tampered, key)).toThrow();
    expect(() => openBackup(Buffer.from("not a backup"), key)).toThrow(/not a Horizon backup/);
  });

  it("prunes copies older than the kept days, never the newest", () => {
    const now = new Date("2026-10-27T02:00:00Z");
    const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
    const objects = [
      { key: "backups/a", lastModified: at(45), size: 1 },
      { key: "backups/b", lastModified: at(31), size: 1 },
      { key: "backups/c", lastModified: at(29), size: 1 },
      { key: "backups/d", lastModified: at(0), size: 1 },
    ];
    expect(staleBackups(objects, 30, now)).toEqual(["backups/b", "backups/a"]);
    // Only one old copy: kept, whatever its age.
    expect(staleBackups([objects[0]], 30, now)).toEqual([]);
  });

  it("reads keys, dates and sizes out of an S3 listing", () => {
    const xml = `<?xml version="1.0"?><ListBucketResult><Name>horizon</Name><Prefix>backups/</Prefix>
      <Contents><Key>backups/horizon-2026-10-26.json.gz.enc</Key><LastModified>2026-10-26T02:00:01.000Z</LastModified><ETag>"x"</ETag><Size>1234</Size></Contents>
      <Contents><Key>backups/a&amp;b</Key><LastModified>2026-10-27T02:00:01.000Z</LastModified><Size>5</Size></Contents></ListBucketResult>`;
    expect(parseListing(xml)).toEqual([
      { key: "backups/horizon-2026-10-26.json.gz.enc", lastModified: "2026-10-26T02:00:01.000Z", size: 1234 },
      { key: "backups/a&b", lastModified: "2026-10-27T02:00:01.000Z", size: 5 },
    ]);
    expect(parseListing("<ListBucketResult></ListBucketResult>")).toEqual([]);
  });
});
