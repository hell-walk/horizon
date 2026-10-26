// The security suite in one command, before a push: builds, starts a production
// server on its own port, runs the suite against it, and stops the server
// whatever happened. The two throwaway logins come from .env.security (git-ignored):
//
//   HORIZON_TEST_EMAIL=...      HORIZON_TEST_PASSWORD=...
//   HORIZON_TEST_EMAIL_2=...    HORIZON_TEST_PASSWORD_2=...
//
//   npm run test:security:local              # build, then run
//   npm run test:security:local -- --no-build  # the build in .next is current
//
// The port (3101 by default, HORIZON_SECURITY_PORT to change) is not 3100, so a
// server you keep running there is left alone. The run's results land in
// reports/security-results.json as usual.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const port = process.env.HORIZON_SECURITY_PORT || "3101";
const base = `http://localhost:${port}`;
const shell = process.platform === "win32";

const env = { ...process.env, HORIZON_URL: base };
if (existsSync(".env.security")) {
  for (const line of readFileSync(".env.security", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
for (const name of ["HORIZON_TEST_EMAIL", "HORIZON_TEST_PASSWORD", "HORIZON_TEST_EMAIL_2", "HORIZON_TEST_PASSWORD_2"]) {
  if (!env[name]) {
    console.error(`Missing ${name}: put the two throwaway logins in .env.security (see tests/security/README.md).`);
    process.exit(1);
  }
}

if (!process.argv.includes("--no-build")) {
  // Next sometimes stops a build on its own upgrade notice; a second go gets through.
  let built = false;
  for (let attempt = 1; attempt <= 3 && !built; attempt++) {
    const build = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell });
    built = build.status === 0;
    if (!built) console.error(`\nBuild attempt ${attempt} did not finish.`);
  }
  if (!built) process.exit(1);
}

const server = spawn("npx", ["next", "start", "-p", port], { stdio: ["ignore", "pipe", "pipe"], shell, env });
let serverOutput = "";
server.stdout.on("data", (d) => (serverOutput += d));
server.stderr.on("data", (d) => (serverOutput += d));
const stop = () => {
  if (server.exitCode !== null) return;
  // On Windows the npx wrapper owns a child node: taskkill takes the tree down.
  if (shell) spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};
process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

// Up when /sign-in answers.
const started = Date.now();
let up = false;
while (!up && Date.now() - started < 60_000) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    up = (await fetch(`${base}/sign-in`, { redirect: "manual" })).status < 500;
  } catch {
    /* not yet */
  }
  if (server.exitCode !== null) break;
}
if (!up) {
  console.error(`The server did not come up on ${base}:\n${serverOutput.slice(-2000)}`);
  stop();
  process.exit(1);
}
console.log(`Server up on ${base}; running the security suite.\n`);

const run = spawnSync("node", ["scripts/run-security-tests.mjs"], { stdio: "inherit", shell, env });
stop();
process.exit(run.status ?? 1);
