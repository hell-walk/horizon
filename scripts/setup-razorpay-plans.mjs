// Creates Horizon's two Razorpay plans (monthly and yearly) from the prices in
// src/lib/plans.ts, and prints the plan ids to put in .env:
//   RAZORPAY_PLAN_MONTHLY=plan_...
//   RAZORPAY_PLAN_YEARLY=plan_...
// Razorpay plans cannot be edited: to change a price, run this again (it makes
// new plans), swap the ids in .env, and old subscribers keep their old price.
// Dry run by default; creates nothing without --apply. Uses the keys in .env
// (test keys create test plans).
//
//   node scripts/setup-razorpay-plans.mjs            # shows what it would create
//   node scripts/setup-razorpay-plans.mjs --apply    # creates them
import { existsSync, readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) if (!env[k]) throw new Error(`${k} is missing from .env`);

// The one source of the prices.
const source = readFileSync("src/lib/plans.ts", "utf8");
const price = (period) => {
  const m = source.match(new RegExp(`${period}: \\{ amount: (\\d+), currency: "INR" \\}`));
  if (!m) throw new Error(`could not read the ${period} price from src/lib/plans.ts`);
  return Number(m[1]);
};
const plans = [
  { period: "monthly", interval: 1, amount: price("monthly"), name: "Horizon monthly" },
  { period: "yearly", interval: 1, amount: price("yearly"), name: "Horizon yearly" },
];

const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
console.log(`${env.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "TEST" : "LIVE"} keys. ${apply ? "Creating:" : "Dry run. With --apply this would create:"}`);
for (const plan of plans) {
  const line = `${plan.name}: ₹${plan.amount} every ${plan.period === "monthly" ? "month" : "year"}`;
  if (!apply) {
    console.log(`  - ${line}`);
    continue;
  }
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    // Razorpay counts in paise.
    body: JSON.stringify({ period: plan.period, interval: plan.interval, item: { name: plan.name, amount: plan.amount * 100, currency: "INR" } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay refused ${plan.name}: ${res.status} ${json.error?.description ?? ""}`);
  console.log(`  - ${line}\n    RAZORPAY_PLAN_${plan.period.toUpperCase()}=${json.id}`);
}
if (apply) console.log("Put those two lines in .env (and in Vercel's environment variables).");
