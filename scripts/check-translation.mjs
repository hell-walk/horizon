// Checks one language's message files against English: same files, same keys,
// no empty texts, every {placeholder} kept, the words that must stay as they
// are (brand and payment names) still there, and no text left in English.
//
//   node scripts/check-translation.mjs ta
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const lang = process.argv[2];
if (!lang) {
  console.error("Usage: node scripts/check-translation.mjs <language code>");
  process.exit(2);
}
const base = "src/lib/i18n/messages";
const KEEP = ["Horizon", "UPI", "EMI", "PDF", "Excel", "CSV", "IFSC", "PAN", "OTP", "INR", "USD", "Razorpay", "Google"];
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const problems = [];
let keys = 0, untranslated = 0;

for (const file of readdirSync(join(base, "en"))) {
  const target = join(base, lang, file);
  if (!existsSync(target)) {
    problems.push(`${file}: missing`);
    continue;
  }
  let en, other;
  try {
    en = JSON.parse(readFileSync(join(base, "en", file), "utf8"));
    other = JSON.parse(readFileSync(target, "utf8"));
  } catch (error) {
    problems.push(`${file}: not valid JSON (${error.message})`);
    continue;
  }
  const missing = Object.keys(en).filter((k) => !(k in other));
  const extra = Object.keys(other).filter((k) => !(k in en));
  if (missing.length) problems.push(`${file}: missing keys ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "..." : ""}`);
  if (extra.length) problems.push(`${file}: extra keys ${extra.slice(0, 8).join(", ")}`);
  for (const [k, v] of Object.entries(en)) {
    const t = other[k];
    if (typeof t !== "string") continue;
    keys++;
    if (!t.trim()) problems.push(`${file} ${k}: empty`);
    if (placeholders(t) !== placeholders(v)) problems.push(`${file} ${k}: placeholders {${placeholders(v)}} became {${placeholders(t)}}`);
    for (const word of KEEP) if (new RegExp(`\\b${word}\\b`).test(v) && !t.includes(word)) problems.push(`${file} ${k}: "${word}" should stay as it is`);
    // Left in English: same as the source and long enough to be a sentence.
    if (t === v && /[a-z]{3,}.*\s.*[a-z]{3,}/i.test(v.replace(/\{\w+\}/g, ""))) untranslated++;
  }
}
console.log(`${lang}: ${keys} texts checked, ${untranslated} identical to English${untranslated ? " (fine for names and codes; check the rest)" : ""}`);
if (problems.length) {
  console.log(problems.slice(0, 60).join("\n"));
  console.log(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log("OK");
