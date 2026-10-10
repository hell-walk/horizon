// Checks a running Horizon deployment from the outside, plus the live Appwrite
// project behind it. Read-only: it changes nothing.
//
//   node scripts/check-deployment.mjs https://your-site.example
//   node scripts/check-deployment.mjs http://localhost:3100 --local     (skips HTTPS/TLS checks)
//
// The Appwrite checks use the server key in .env, so run it from the project folder
// with the same .env as the deployment.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import tls from "node:tls";

const target = process.argv[2];
const local = process.argv.includes("--local");
if (!target) {
  console.error("Usage: node scripts/check-deployment.mjs <url> [--local]");
  process.exit(2);
}
const base = new URL(target);
const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });
const get = (path, init = {}) => fetch(new URL(path, base), { redirect: "manual", ...init });

// 1. Transport
if (!local) {
  ok("Site is served over HTTPS", base.protocol === "https:", base.protocol);
  const http = new URL(base);
  http.protocol = "http:";
  const plain = await fetch(http, { redirect: "manual" }).catch(() => null);
  ok("Plain HTTP redirects to HTTPS", Boolean(plain && [301, 302, 307, 308].includes(plain.status) && plain.headers.get("location")?.startsWith("https:")), plain ? `${plain.status} -> ${plain.headers.get("location")}` : "no answer on port 80");

  const tlsInfo = (opts) =>
    new Promise((resolve) => {
      const socket = tls.connect({ host: base.hostname, port: Number(base.port) || 443, servername: base.hostname, ...opts }, () => {
        const info = { protocol: socket.getProtocol(), authorized: socket.authorized, cert: socket.getPeerCertificate() };
        socket.end();
        resolve(info);
      });
      socket.on("error", (e) => resolve({ error: e.code ?? e.message }));
      socket.setTimeout(8000, () => socket.destroy(new Error("timeout")));
    });
  const modern = await tlsInfo({});
  ok("TLS 1.2 or 1.3 with a valid certificate", !modern.error && /TLSv1\.[23]/.test(modern.protocol ?? "") && modern.authorized, modern.error ?? modern.protocol);
  if (modern.cert?.valid_to) {
    const days = Math.round((Date.parse(modern.cert.valid_to) - Date.now()) / 86400000);
    ok("Certificate valid for at least 14 more days", days >= 14, `${days} days left`);
  }
  const old = await tlsInfo({ maxVersion: "TLSv1.1", minVersion: "TLSv1" });
  ok("Old TLS (1.0/1.1) is refused", Boolean(old.error), old.error ? "refused" : `accepted ${old.protocol}`);
}

// 2. Headers
const signIn = await get("/sign-in");
const h = (name) => signIn.headers.get(name) ?? "";
ok("Sign-in page answers", signIn.status === 200, String(signIn.status));
if (!local) ok("HSTS for at least a year", /max-age=(\d+)/.test(h("strict-transport-security")) && Number(h("strict-transport-security").match(/max-age=(\d+)/)[1]) >= 31536000, h("strict-transport-security"));
ok("Content-Security-Policy without unsafe-eval", h("content-security-policy").includes("default-src") && !h("content-security-policy").includes("unsafe-eval"));
ok("CSP forbids framing and plugins", h("content-security-policy").includes("frame-ancestors 'none'") && h("content-security-policy").includes("object-src 'none'"));
ok("X-Frame-Options: DENY", h("x-frame-options") === "DENY", h("x-frame-options"));
ok("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff");
ok("Referrer-Policy set", Boolean(h("referrer-policy")), h("referrer-policy"));
ok("Permissions-Policy set", Boolean(h("permissions-policy")));
ok("No X-Powered-By", !signIn.headers.has("x-powered-by"));
ok("Server header does not give a version", !/\d/.test(h("server")), h("server") || "none");

// 3. Locked pages and private files
for (const path of ["/", "/my-banks", "/transaction-history", "/payment-transfer", "/connect-bank"]) {
  const res = await get(path);
  ok(`${path} needs sign-in`, [302, 303, 307, 308].includes(res.status) && (res.headers.get("location") ?? "").includes("/sign-in"), `${res.status}`);
}
for (const path of ["/.env", "/.env.local", "/.git/config", "/package.json", "/.next/server/server-reference-manifest.json"]) {
  const res = await get(path);
  const text = await res.text();
  ok(`${path} not served`, !/APPWRITE|SECRET|\[core\]|"dependencies"|exportedName/.test(text), String(res.status));
}
const html = await signIn.text();
const script = html.match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1];
if (script) ok("Client source maps not public", (await get(`${script}.map`)).status !== 200);
const bogus = await get("/sign-in", { method: "POST", headers: { "Next-Action": "00" + "ab".repeat(20), "Content-Type": "text/plain", Origin: base.origin }, body: "[]" });
ok("Unknown server action refused", bogus.status >= 400, String(bogus.status));
const cross = await get("/sign-in", { method: "POST", headers: { "Next-Action": "00" + "cd".repeat(20), "Content-Type": "text/plain", Origin: "https://evil.example" }, body: "[]" });
ok("Cross-site action post refused", cross.status >= 400, String(cross.status));

// 4. The live Appwrite project
if (existsSync(".env")) {
  const env = Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
  );
  ok("DATA_ENCRYPTION_KEY is 32 bytes", Buffer.from(env.DATA_ENCRYPTION_KEY ?? "", "base64").length === 32);
  const leaky = Object.entries(env).filter(([k, v]) => k.startsWith("NEXT_PUBLIC_") && /KEY|SECRET|TOKEN|PASSWORD/i.test(k) && v);
  ok("No secrets in NEXT_PUBLIC_ variables (those reach the browser)", leaky.length === 0, leaky.map(([k]) => k).join(", "));

  const require = createRequire(import.meta.url);
  const { Client, Databases, Query } = require("node-appwrite");
  const db = new Databases(new Client().setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT).setKey(env.NEXT_APPWRITE_KEY));
  const { collections } = await db.listCollections(env.APPWRITE_DATABASE_ID);
  for (const c of collections) {
    ok(`Appwrite "${c.name}": no client permissions`, c.$permissions.length === 0 && !c.documentSecurity, c.$permissions.join(" ") || "server key only");
  }
  const banks = [];
  for (let cursor; ; ) {
    const page = await db.listDocuments(env.APPWRITE_DATABASE_ID, env.APPWRITE_BANK_COLLECTION_ID, [Query.limit(100), Query.select(["$id", "accessToken"]), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    banks.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents.at(-1).$id;
  }
  const plain = banks.filter((b) => b.accessToken && !b.accessToken.startsWith("enc:v1:")).length;
  ok("Every bank token is encrypted", plain === 0, `${plain} of ${banks.length} still plain text (run scripts/migrate-legacy-secrets.mjs)`);
  const profiles = (await db.listDocuments(env.APPWRITE_DATABASE_ID, env.APPWRITE_USER_COLLECTION_ID, [Query.limit(100), Query.select(["$id", "ssn", "dateOfBirth"])])).documents;
  const pii = profiles.filter((p) => p.ssn !== "not-kept" || p.dateOfBirth !== "not-kept").length;
  ok("No SSN or date of birth stored", pii === 0, `${pii} of ${profiles.length} profiles still hold them`);
}

// Report
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.pass ? "" : r.detail}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base.origin}${local ? " (local: HTTPS/TLS skipped)" : ""}`);
process.exit(failed ? 1 : 0);
