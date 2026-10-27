import "server-only";

import { createHash, createHmac } from "node:crypto";

// Cloudflare R2 through its S3-compatible API, signed by hand (AWS Signature
// Version 4): four calls, no SDK. Used for the nightly backup. Needs
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.

export type R2Object = { key: string; lastModified: string; size: number };

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();
/** RFC 3986 encoding, as S3 wants it in the canonical request (encodeURIComponent leaves !'()* alone). */
const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const settings = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  if (!account || !keyId || !secret || !bucket) throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  return { host: `${account}.r2.cloudflarestorage.com`, keyId, secret, bucket };
};
export const isR2Configured = () => Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

/** One signed request to the bucket: `path` is the object key ("" for the bucket itself), `query` already sorted by name. */
async function call(method: "GET" | "PUT" | "DELETE", path: string, query: Record<string, string> = {}, body?: Buffer) {
  const { host, keyId, secret, bucket } = settings();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");
  const canonicalUri = `/${bucket}${path ? `/${path.split("/").map(encode).join("/")}` : ""}`;
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encode(k)}=${encode(query[k])}`)
    .join("&");
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join("");
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  const res = await fetch(url, { method, headers: { ...headers, authorization }, body: body ? new Uint8Array(body) : undefined });
  if (!res.ok) throw new Error(`R2 ${method} ${path || "(bucket)"} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export const r2Put = async (key: string, body: Buffer) => {
  await call("PUT", key, {}, body);
};
export const r2Get = async (key: string) => Buffer.from(await (await call("GET", key)).arrayBuffer());
export const r2Delete = async (key: string) => {
  await call("DELETE", key);
};

/** The objects under a prefix (one page of up to 1000; a backup folder never holds more). */
export async function r2List(prefix: string): Promise<R2Object[]> {
  const xml = await (await call("GET", "", { "list-type": "2", prefix })).text();
  return parseListing(xml);
}

/** The keys, dates and sizes out of an S3 ListObjectsV2 answer. */
export function parseListing(xml: string): R2Object[] {
  const out: R2Object[] = [];
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = m[1].match(/<Key>([^<]*)<\/Key>/)?.[1];
    const lastModified = m[1].match(/<LastModified>([^<]*)<\/LastModified>/)?.[1];
    const size = Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
    if (key && lastModified) out.push({ key: decodeXml(key), lastModified, size });
  }
  return out;
}
const decodeXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
