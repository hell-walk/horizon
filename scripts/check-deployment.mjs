// Checks a running Horizon deployment from the outside, plus the live Appwrite,
// Supabase and Razorpay accounts behind it. Read-only: it changes nothing.
//
//   node scripts/check-deployment.mjs https://your-site.example
//   node scripts/check-deployment.mjs http://localhost:3100 --local     (skips HTTPS/TLS checks)
//
// The account checks use the keys in .env, so run it from the project folder
// with the same .env as the deployment. Keys are used, never printed.
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
try {
  await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
} catch {
  console.error(`Nothing answers at ${base.origin}.`);
  if (["localhost", "127.0.0.1"].includes(base.hostname)) {
    console.error(`Start a production build first:  npm run build  then  npx next start -p ${base.port || 3000}`);
  }
  process.exit(2);
}
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
for (const path of ["/", "/my-banks", "/transaction-history", "/payment-transfer", "/connect-bank", "/bills", "/goals", "/my-data", "/plans", "/feedback"]) {
  const res = await get(path);
  ok(`${path} needs sign-in`, [302, 303, 307, 308].includes(res.status) && (res.headers.get("location") ?? "").includes("/sign-in"), `${res.status}`);
}
for (const path of ["/.env", "/.env.local", "/.git/config", "/package.json", "/.next/server/server-reference-manifest.json"]) {
  const res = await get(path);
  const text = await res.text();
  ok(`${path} not served`, !/APPWRITE|SECRET|\[core\]|"dependencies"|exportedName/.test(text), String(res.status));
}
// Pages Razorpay checks before it activates payments, open to everyone.
for (const path of ["/pricing", "/refunds", "/contact", "/privacy", "/terms"]) {
  ok(`${path} is public`, (await get(path)).status === 200);
}
const contact = await (await get("/contact")).text();
ok("Contact page shows a real email (NEXT_PUBLIC_CONTACT_EMAIL)", !contact.includes("support@horizon.app"), "still the placeholder support@horizon.app");
const webhook = await get("/api/razorpay/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
ok("Unsigned Razorpay webhook refused", webhook.status === 401, String(webhook.status));

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

  const need = [
    "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CONTACT_EMAIL", "DATA_ENCRYPTION_KEY",
    "NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT", "NEXT_APPWRITE_KEY", "APPWRITE_DATABASE_ID", "APPWRITE_FEEDBACK_COLLECTION_ID",
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
    "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_PLAN_MONTHLY", "RAZORPAY_PLAN_YEARLY", "RAZORPAY_WEBHOOK_SECRET",
  ];
  const missing = need.filter((k) => !env[k]);
  ok("Every required setting is in .env", missing.length === 0, `missing: ${missing.join(", ")}`);
  if (!local) ok("NEXT_PUBLIC_SITE_URL is the https address", (env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"), env.NEXT_PUBLIC_SITE_URL ?? "unset");

  // Supabase: sign-ups must confirm their email (otherwise someone could take an address that is not theirs).
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    const settings = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .catch(() => null);
    ok("Supabase answers", Boolean(settings));
    if (settings) {
      ok("Supabase: email confirmation is ON", settings.mailer_autoconfirm === false, "turn on Authentication -> Sign In / Providers -> Email -> Confirm email");
      ok("Supabase: Google sign-in is on", settings.external?.google === true);
    }
  }

  // Razorpay: keys work, both plans exist, and their prices match src/lib/plans.ts.
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const auth = { Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}` };
    const payments = await fetch("https://api.razorpay.com/v1/payments?count=1", { headers: auth }).catch(() => null);
    ok("Razorpay keys work", payments?.status === 200, String(payments?.status ?? "no answer"));
    const keys = await fetch("https://api.razorpay.com/v1/plans?count=1", { headers: auth }).catch(() => null);
    ok("Razorpay Subscriptions is switched on", keys?.status === 200, keys?.status === 401 ? "enable Subscriptions in the Razorpay dashboard" : String(keys?.status ?? "no answer"));
    if (!local) ok("Razorpay keys are live (not test)", env.RAZORPAY_KEY_ID.startsWith("rzp_live_"), "test keys: no real payments");
    const source = readFileSync("src/lib/plans.ts", "utf8");
    for (const period of ["monthly", "yearly"]) {
      const id = env[`RAZORPAY_PLAN_${period.toUpperCase()}`];
      if (!id || keys?.status !== 200) continue;
      const plan = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(id)}`, { headers: auth }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const price = Number(source.match(new RegExp(`${period}: \\{ amount: (\\d+)`))?.[1]);
      ok(`Razorpay ${period} plan matches src/lib/plans.ts`, plan?.period === period && plan?.item?.amount === price * 100, plan ? `Razorpay says ${plan.item.amount / 100} every ${plan.period}` : "plan not found");
    }
  }

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
