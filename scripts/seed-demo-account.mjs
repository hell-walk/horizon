// Makes (or refreshes) the demo login whose screens the landing page shows:
// a believable Indian household with three banks, four months of statements,
// a few subscriptions and three savings goals. Everything goes through the
// app's own actions on a running copy of the site, so the pages look exactly
// as they would for a real person. Nothing here touches other logins.
//
//   node scripts/seed-demo-account.mjs <credentials file> [http://localhost:3100]
//
// The credentials file gets the email and password (made up on first run,
// reused after); keep it out of the repository. Needs the site built and
// running at the address given (the actions are called the way the browser
// calls them), plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const [credFile, baseArg] = process.argv.slice(2);
if (!credFile) {
  console.error("Usage: node scripts/seed-demo-account.mjs <credentials file> [site address]");
  process.exit(1);
}
const BASE = (baseArg ?? "http://localhost:3100").replace(/\/$/, "");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. The login: Aarav Mehta in Mumbai, made once.
let email, password;
if (existsSync(credFile)) {
  [email, password] = readFileSync(credFile, "utf8").split(/\r?\n/);
  console.log(`using the demo login from ${credFile}`);
} else {
  email = `horizon-demo-${Date.now()}@example.com`;
  password = `Demo-${randomBytes(12).toString("base64url")}`;
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Aarav Mehta",
      terms_accepted_at: new Date().toISOString(),
      pending_profile: { country: "IN", firstName: "Aarav", lastName: "Mehta", address1: "14 Carter Road, Bandra West", city: "Mumbai", state: "MH", postalCode: "400050" },
    },
  });
  if (error) throw new Error(error.message);
  writeFileSync(credFile, `${email}\n${password}\n`, "utf8");
  console.log(`made the demo login; credentials written to ${credFile}`);
}

// 2. Ten years of access, so neither the trial banner nor the daily change limit shows.
execFileSync(process.execPath, ["scripts/grant-plan.mjs", email, "3650", "--apply"], { stdio: "inherit" });

// 3. Sign in the way the browser does (a server action), and let /welcome make the profile.
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const actionIds = Object.fromEntries(Object.entries(manifest.node).map(([id, v]) => [v.exportedName, id]));
const action = (name, path, body, extra = {}) =>
  fetch(`${BASE}${path}`, { method: "POST", headers: { "Next-Action": actionIds[name], Accept: "text/x-component", Origin: BASE, ...extra.headers }, body, redirect: "manual" });

const signIn = await action("signIn", "/sign-in", JSON.stringify([{ email, password }]), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => /^horizon-session(\.\d+)?=./.test(c)).join("; ");
if (!cookie) throw new Error(`sign-in failed (${signIn.status})`);
await fetch(`${BASE}/welcome`, { headers: { Cookie: cookie }, redirect: "manual" });

// 4. Statements. Dates run from four months ago to today; amounts are typical
//    for a Mumbai salaried household. Narrations read like real bank exports.
const today = new Date();
const monthsBack = 4;
const day = (y, m, d) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const csv = (rows, opening) => {
  rows.sort((a, b) => a[0] - b[0]);
  let balance = opening;
  const lines = ["Date,Narration,Debit,Credit,Balance"];
  for (const [d, text, debit, credit] of rows) {
    if (d > today) continue;
    balance += credit - debit;
    lines.push(`${fmt(d)},"${text}",${debit || ""},${credit || ""},${balance.toFixed(2)}`);
  }
  return lines.join("\n");
};
const months = [];
for (let i = monthsBack; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1));

const hdfc = [];
const icici = [];
const sbi = [];
for (const m of months) {
  const y = m.getFullYear(), mo = m.getMonth();
  const at = (d) => day(y, mo, d);
  hdfc.push(
    [at(1), "NEFT CR-ACME TECHNOLOGIES PVT LTD-SALARY", 0, 145000],
    [at(2), "UPI-SIMPL PAY LATER-SETTLEMENT", 4120, 0],
    [at(3), "UPI-RAHUL SHARMA-RENT", 32000, 0],
    [at(5), "ACH D- HDFC BANK CAR LOAN EMI", 22480, 0],
    [at(6), "IMPS-ICICI BANK-SELF TRANSFER", 20000, 0],
    [at(7), "UPI-BIGBASKET-GROCERIES", 3860, 0],
    [at(4), "UPI-JIO PREPAID RECHARGE-PAYTM", 349, 0],
    [at(8), "BILLDESK-AIRTEL POSTPAID", 999, 0],
    [at(9), "UPI-SWIGGY-ORDER", 540, 0],
    [at(10), "ZERODHA BROKING LTD-FUNDS", 25000, 0],
    [at(11), "POS-UBER INDIA", 320, 0],
    [at(12), "NETFLIX.COM-MEMBERSHIP", 649, 0],
    [at(13), "UPI-ZOMATO-ORDER", 780, 0],
    [at(14), "ATM WDL-HDFC ATM BANDRA", 5000, 0],
    [at(15), "TATA POWER-ELECTRICITY BILL", 2340, 0],
    [at(17), "UPI-TATA PLAY DTH RECHARGE", 400, 0],
    [at(16), "UPI-APOLLO PHARMACY", 1260, 0],
    [at(18), "GOOGLE-YOUTUBE PREMIUM", 149, 0],
    [at(19), "UPI-BLINKIT-GROCERIES", 1420, 0],
    [at(20), "CRUNCHYROLL-SUBSCRIPTION", 99, 0],
    [at(21), "POS-STARBUCKS BANDRA", 460, 0],
    [at(22), "UPI-SWIGGY-ORDER", 610, 0],
    [at(23), "AMAZON PAY-ORDER", 2890, 0],
    [at(24), "UPI-RELIANCE SMART-GROCERIES", 2150, 0],
    [at(25), "IRCTC-TICKET BOOKING", 1540, 0],
    [at(26), "UPI-MYNTRA-ORDER", 3200, 0],
    [at(27), "POS-HP PETROL PUMP", 3000, 0],
    [at(28), "UPI-PVR CINEMAS", 920, 0],
    [at(29), "INTEREST CREDIT", 0, 412],
  );
  icici.push(
    [at(6), "IMPS/HDFC BANK/SELF TRANSFER", 0, 20000],
    [at(7), "SIP-ICICI PRU BLUECHIP FUND", 10000, 0],
    [at(12), "UPI/FLIPKART/ORDER", 2460, 0],
    [at(15), "UPI/DECATHLON/ORDER", 1890, 0],
    [at(20), "POS/LIFESTYLE STORES", 3120, 0],
    [at(24), "UPI/BOOKMYSHOW", 760, 0],
    [at(28), "INTEREST CREDIT", 0, 168],
  );
  sbi.push([at(15), "LIC OF INDIA-PREMIUM", mo % 3 === 0 ? 12450 : 0, 0], [at(26), "INTEREST CREDIT", 0, 740]);
}

const statements = [
  ["HDFC Bank", "4821", csv(hdfc.filter((r) => r[2] || r[3]), 118000)],
  ["ICICI Bank", "1092", csv(icici.filter((r) => r[2] || r[3]), 46500)],
  ["State Bank of India", "7788", csv(sbi.filter((r) => r[2] || r[3]), 294000)],
];
for (const [institution, mask, text] of statements) {
  const body = new FormData();
  body.set("_1_file", new File([text], `${institution.toLowerCase().replace(/\W+/g, "-")}-statement.csv`, { type: "text/csv" }));
  body.set("_1_institution", institution);
  body.set("_1_mask", mask);
  body.set("_1_keepLikely", "1");
  body.set("0", '["$K1"]');
  const res = await action("importStatement", "/connect-bank", body, { headers: { Cookie: cookie } });
  const reply = await res.text();
  const bankId = reply.match(/"bankId":"([a-z0-9]+)"/)?.[1];
  console.log(`${institution} ••${mask}: ${res.status} ${bankId ? `bank ${bankId}` : reply.slice(0, 200)}`);
}

// 5. Three goals.
const goals = [
  { name: "Emergency fund", target: 600000, saved: 410000, monthly: 25000 },
  { name: "Japan trip", target: 300000, saved: 135000, monthly: 15000, by: `${today.getFullYear() + 1}-03` },
  { name: "Home down payment", target: 2500000, saved: 640000, monthly: 40000 },
];
for (const goal of goals) {
  const res = await action("saveGoal", "/goals", JSON.stringify([goal]), { headers: { Cookie: cookie, "Content-Type": "text/plain;charset=UTF-8" } });
  console.log(`goal "${goal.name}": ${res.status}`);
}
console.log("Done. Sign in with the demo login to check, then run scripts/capture-landing-shots.mjs with it.");
