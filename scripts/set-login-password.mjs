// Gives a Supabase login a password, typed at a hidden prompt, for when the
// reset email cannot reach someone. Logins moved over from Appwrite have no
// password at all (passwords cannot be copied), so email sign-in says
// "invalid" for them until one is set here or through "Forgot password".
//
//   node scripts/set-login-password.mjs someone@example.com
//
// From a script, pipe the password and its repeat in as two lines instead.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env). The password
// never appears on the command line, in the shell history or in this output.
// Same rules as the sign-up form: 8 to 128 characters, not a well-known one,
// not containing the part of the email before the @.
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { createClient } from "@supabase/supabase-js";

const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[name]) {
    console.error(`Missing ${name} (put it in .env).`);
    process.exit(1);
  }
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/set-login-password.mjs someone@example.com");
  process.exit(1);
}
const hide = (address) => address.replace(/^(.{2}).*@/, "$1…@");

const COMMON = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "11111111", "00000000", "abcd1234", "admin123", "letmein1", "welcome1"]);
function problem(password) {
  if (password.length < 8) return "at least 8 characters";
  if (password.length > 128) return "at most 128 characters";
  if (COMMON.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) return "not a well-known password";
  const name = email.split("@")[0];
  if (name.length >= 4 && password.toLowerCase().includes(name.toLowerCase())) return "must not contain the part of the email before the @";
  return null;
}

/** Reads one line without echoing it (the terminal shows nothing while typing). */
function askHidden(rl, echo, question) {
  return new Promise((resolve) => {
    rl._writeToOutput = (text) => {
      if (text.includes(question)) echo.call(rl, question);
    };
    rl.question(question, (answer) => {
      rl._writeToOutput = echo;
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

/** The password and its repeat: typed at hidden prompts, or piped in as two lines (for scripts). */
async function readPasswords() {
  if (!process.stdin.isTTY) {
    let data = "";
    for await (const chunk of process.stdin) data += chunk;
    const [first = "", second = ""] = data.split(/\r?\n/);
    return [first, second];
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const echo = rl._writeToOutput;
  const first = await askHidden(rl, echo, "New password (hidden): ");
  const second = await askHidden(rl, echo, "Type it again: ");
  rl.close();
  return [first, second];
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Find the login by email (the admin list is paged; a few pages cover a small site).
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`Could not list logins: ${error.message}`);
    process.exit(1);
  }
  user = data.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`No login for ${hide(email)}.`);
  process.exit(1);
}
console.log(`Login ${hide(email)} found (signs in with: ${(user.app_metadata?.providers ?? []).join(", ") || "nothing yet"}).`);

const [password, again] = await readPasswords();
if (password !== again) {
  console.error("The two did not match. Nothing changed.");
  process.exit(1);
}
const why = problem(password);
if (why) {
  console.error(`That password is not allowed: ${why}. Nothing changed.`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
if (error) {
  console.error(`Could not set the password: ${error.message}`);
  process.exit(1);
}
console.log(`Done. ${hide(email)} can sign in with the email and the new password now (Google keeps working too).`);
