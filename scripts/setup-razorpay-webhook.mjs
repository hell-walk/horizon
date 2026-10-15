// Makes sure Razorpay has a webhook pointing at this site, through Razorpay's
// API rather than its dashboard. Razorpay keeps separate webhooks for test
// and live mode, and the dashboard only shows and makes the mode it is in
// (one made there while in live mode never hears about test subscriptions).
// The API keys decide the mode: rzp_test_ keys make a test-mode webhook,
// rzp_live_ keys a live-mode one.
//
//   node scripts/setup-razorpay-webhook.mjs            # shows what exists and what it would do
//   node scripts/setup-razorpay-webhook.mjs --apply    # creates the webhook if it is missing
//
// Needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and
// NEXT_PUBLIC_SITE_URL (the live https address). The webhook signs with
// RAZORPAY_WEBHOOK_SECRET, so the same value must be set on the server.
import { existsSync, readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const name of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "NEXT_PUBLIC_SITE_URL"]) {
  if (!env[name]) {
    console.error(`Missing ${name} (put it in .env).`);
    process.exit(1);
  }
}
if (!env.NEXT_PUBLIC_SITE_URL.startsWith("https://")) {
  console.error("NEXT_PUBLIC_SITE_URL must be the live https address: Razorpay only delivers to public https URLs.");
  process.exit(1);
}

const mode = env.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "test" : "live";
const url = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/razorpay/webhook`;
// Everything the webhook route acts on (subscription.*); the rest it ignores.
const EVENTS = ["authenticated", "activated", "charged", "pending", "halted", "cancelled", "completed", "paused", "resumed", "updated"].map((e) => `subscription.${e}`);
const auth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

async function call(path, body) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${json.error?.description ?? JSON.stringify(json).slice(0, 200)}`);
  return json;
}

const { items } = await call("/webhooks?count=100");
console.log(`${mode} mode: ${items.length} webhook(s) on this account.`);
for (const w of items) {
  const on = Object.entries(w.events ?? {}).filter(([, v]) => v).map(([k]) => k);
  const missing = EVENTS.filter((e) => !on.includes(e));
  console.log(`  ${w.id}  ${w.url}  ${w.active ? "active" : "DISABLED"}  ${on.length} events${missing.length ? `, missing: ${missing.join(", ")}` : ""}`);
}

const ours = items.find((w) => w.url === url && w.active);
if (ours) {
  const on = Object.entries(ours.events ?? {}).filter(([, v]) => v).map(([k]) => k);
  const missing = EVENTS.filter((e) => !on.includes(e));
  console.log(missing.length ? `A webhook for ${url} exists but lacks ${missing.join(", ")}: edit it in the dashboard (or delete it and run this again).` : `Nothing to do: ${url} already has an active ${mode}-mode webhook with every subscription event.`);
  process.exit(0);
}

console.log(`${apply ? "Creating" : "Would create"} a ${mode}-mode webhook for ${url} with ${EVENTS.length} subscription events, alerts to ${env.NEXT_PUBLIC_CONTACT_EMAIL || "(no NEXT_PUBLIC_CONTACT_EMAIL: no alert email)"}.`);
if (!apply) {
  console.log("Run again with --apply to do it.");
  process.exit(0);
}
const created = await call("/webhooks", {
  url,
  secret: env.RAZORPAY_WEBHOOK_SECRET,
  ...(env.NEXT_PUBLIC_CONTACT_EMAIL ? { alert_email: env.NEXT_PUBLIC_CONTACT_EMAIL } : {}),
  events: Object.fromEntries(EVENTS.map((e) => [e, true])),
});
console.log(`Created ${created.id} (${created.active ? "active" : "not active"}). Razorpay will now deliver ${mode}-mode subscription events to ${url}.`);
