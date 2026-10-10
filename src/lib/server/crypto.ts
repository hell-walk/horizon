import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Secrets at rest (bank access tokens) are sealed with AES-256-GCM under
// DATA_ENCRYPTION_KEY, a 32-byte key in base64. Sealed values carry a prefix so
// rows written before encryption existed still read as plain text.
const PREFIX = "enc:v1:";

let warned = false;

function key(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is not set");
    if (!warned) {
      console.warn("[crypto] DATA_ENCRYPTION_KEY is not set; secrets are stored unencrypted (development only)");
      warned = true;
    }
    return null;
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return decoded;
}

export function sealSecret(plain: string): string {
  const k = key();
  if (!k || !plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openSecret(value: string): string {
  if (!value?.startsWith(PREFIX)) return value; // stored before encryption
  const k = key();
  if (!k) throw new Error("A sealed secret was found but DATA_ENCRYPTION_KEY is not set");
  const data = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", k, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

/** Opens a value that must have been sealed: plain text is refused, not passed through. */
export function openSealed(value: string): string {
  if (!value?.startsWith(PREFIX)) throw new Error("Not a sealed value");
  return openSecret(value);
}

/** An id that can be shared to receive transfers: random, so it says nothing about the account. */
export const newSharableId = () => randomBytes(18).toString("base64url");
