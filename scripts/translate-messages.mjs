// Machine-translates the interface text with Google Cloud Translation.
// Only the English interface strings in src/lib/i18n/messages/en are sent:
// never user data (balances, names, statements).
//
//   GOOGLE_TRANSLATE_API_KEY=... node scripts/translate-messages.mjs ta        new language (Tamil)
//   GOOGLE_TRANSLATE_API_KEY=... node scripts/translate-messages.mjs hi --missing   fill keys added since
//
// Writes src/lib/i18n/messages/<lang>/*.json. For a new language, add its code to
// LOCALES / LOCALE_NAMES / LOCALE_TAGS in src/lib/i18n/config.ts and its files to
// src/lib/i18n/messages/index.ts, then have a native speaker read it through:
// machine translation is a first draft, especially for money wording.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [lang, ...flags] = process.argv.slice(2);
const missingOnly = flags.includes("--missing");
const key = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!lang || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)) {
  console.error("Usage: node scripts/translate-messages.mjs <language code> [--missing]");
  process.exit(2);
}
if (!key) {
  console.error("Set GOOGLE_TRANSLATE_API_KEY (Google Cloud console > APIs > Cloud Translation API).");
  process.exit(2);
}

const base = "src/lib/i18n/messages";
mkdirSync(join(base, lang), { recursive: true });

// Brand and payment names stay as they are; {placeholders} must survive.
const KEEP = ["Horizon", "UPI", "Plaid", "Setu", "Dwolla", "PDF", "Excel", "CSV", "XLSX", "XLS", "IFSC", "PAN", "OTP"];
const protect = (text) => {
  const kept = [];
  const hold = (m) => `<span translate="no">${kept.push(m) - 1}</span>`;
  let out = text.replace(/\{\w+\}/g, hold);
  for (const word of KEEP) out = out.replace(new RegExp(`\\b${word}\\b`, "g"), hold);
  return { out, kept };
};
const restore = (text, kept) => text.replace(/<span translate="no">(\d+)<\/span>/g, (_, i) => kept[Number(i)]);

async function translate(texts) {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, source: "en", target: lang, format: "html" }),
  });
  if (!res.ok) throw new Error(`Google Translation API: ${res.status} ${await res.text()}`);
  return (await res.json()).data.translations.map((t) => t.translatedText);
}

let total = 0;
for (const file of readdirSync(join(base, "en")).filter((f) => f.endsWith(".json"))) {
  const english = JSON.parse(readFileSync(join(base, "en", file), "utf8"));
  const target = join(base, lang, file);
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
  const todo = Object.keys(english).filter((k) => !missingOnly || !(k in existing));
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const prepared = batch.map((k) => protect(english[k]));
    const done = await translate(prepared.map((p) => p.out));
    batch.forEach((k, j) => (existing[k] = restore(done[j], prepared[j].kept)));
  }
  const ordered = Object.fromEntries(Object.keys(english).filter((k) => k in existing).map((k) => [k, existing[k]]));
  writeFileSync(target, JSON.stringify(ordered, null, 2) + "\n");
  total += todo.length;
  console.log(`${file}: ${todo.length} translated`);
}
console.log(`Done: ${total} texts into "${lang}". Now register the language (see the top of this script) and get it proofread.`);
