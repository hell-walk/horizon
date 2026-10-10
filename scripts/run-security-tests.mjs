// Runs the black-box security suite and fails unless every test really ran:
// no failures, no skips, and at least the expected number of tests. The raw
// results are kept in reports/security-results.json as evidence of the run.
//
//   npm run test:security
//
// HORIZON_SECURITY_ALLOW_SKIP=1 relaxes the skip and count checks (local poking only).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const MIN_TESTS = 103; // 83 attack tests + 19 in the authorization grid + 1 account deletion
const OUTPUT = "reports/security-results.json";
const allowSkip = process.env.HORIZON_SECURITY_ALLOW_SKIP === "1";

mkdirSync("reports", { recursive: true });
const run = spawnSync("npx", ["vitest", "run", "--project", "security", "--reporter=default", "--reporter=json", `--outputFile.json=${OUTPUT}`], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

let results;
try {
  results = JSON.parse(readFileSync(OUTPUT, "utf8"));
} catch {
  console.error(`\nSecurity run produced no results file (${OUTPUT}).`);
  process.exit(1);
}

const { numTotalTests: total, numPassedTests: passed, numFailedTests: failed, numPendingTests: skipped, numTodoTests: todo } = results;
console.log(`\nSecurity tests: ${passed} passed, ${failed} failed, ${skipped} skipped, ${todo} todo, ${total} total (results in ${OUTPUT})`);

const problems = [];
if (run.status !== 0 || failed > 0) problems.push(`${failed} failed`);
if (!allowSkip && skipped + todo > 0) problems.push(`${skipped + todo} did not run (skipped tests count as failures)`);
if (!allowSkip && passed < MIN_TESTS) problems.push(`only ${passed} passed, expected at least ${MIN_TESTS}`);

if (problems.length) {
  console.error(`Security run NOT OK: ${problems.join("; ")}.`);
  process.exit(1);
}
console.log("Security run OK: every test ran and passed.");
