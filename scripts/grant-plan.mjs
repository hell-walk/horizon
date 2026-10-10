// Gives someone Horizon for free for a while (a friend, a tester, an apology),
// without Razorpay: the same record a paid subscription leaves, marked "comp".
// The admin portal will do this from a button later; until then, this script.
//
//   node scripts/grant-plan.mjs someone@example.com 30          # dry run: 30 days
//   node scripts/grant-plan.mjs someone@example.com 30 --apply  # does it
//   node scripts/grant-plan.mjs someone@example.com 0 --apply   # takes it away
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");
const [email, daysText] = args;
const days = Number(daysText);
if (!email?.includes("@") || !Number.isInteger(days) || days < 0 || days > 3660) {
  console.error("Usage: node scripts/grant-plan.mjs <email> <days, 0 to remove> [--apply]");
  process.exit(1);
}

const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!env[k]) throw new Error(`${k} is missing from .env`);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const hide = (e) => e.replace(/^(.)[^@]*(@.).*(\..*)$/, "$1***$2***$3");
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`Supabase: ${error.message}`);
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`No login with the email ${hide(email)}.`);
  process.exit(1);
}

const current = user.app_metadata?.subscription;
if (current && !String(current.id).startsWith("comp_") && current.status !== "cancelled" && current.until > Date.now()) {
  console.error(`${hide(email)} has a paid subscription; cancel it first (or wait for it to end).`);
  process.exit(1);
}
const subscription = days === 0 ? null : { id: `comp_${Date.now()}`, period: "monthly", status: "cancelled", until: Date.now() + days * 86_400_000 };
const what = days === 0 ? "remove the free access" : `free access until ${new Date(subscription.until).toDateString()} (does not renew)`;
if (!apply) {
  console.log(`Dry run. With --apply this would give ${hide(email)}: ${what}.`);
  process.exit(0);
}
const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { subscription } });
if (error) throw new Error(`Supabase: ${error.message}`);
console.log(`Done: ${hide(email)}: ${what}.`);
