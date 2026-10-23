// Takes the screenshots the landing page shows: real app pages, light and
// dark, from a running copy of the site signed in as a demo account.
// Nothing is faked: whatever the app shows is what visitors see.
//
//   node scripts/capture-landing-shots.mjs http://localhost:3100
//
// Needs HORIZON_SHOT_EMAIL / HORIZON_SHOT_PASSWORD (a demo login with a few
// banks, bills and goals) and Chrome on this machine. Writes PNGs to
// public/landing/. Re-run whenever the app's look changes.
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const base = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const email = process.env.HORIZON_SHOT_EMAIL;
const password = process.env.HORIZON_SHOT_PASSWORD;
if (!email || !password) {
  console.error("Set HORIZON_SHOT_EMAIL and HORIZON_SHOT_PASSWORD (a demo login).");
  process.exit(1);
}
const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => existsSync(p));
if (!chrome) {
  console.error("Chrome not found.");
  process.exit(1);
}

// What the landing page talks about, in its order.
const SHOTS = [
  ["home", "/", 1280, 820],
  ["history", "/transaction-history", 1280, 820],
  ["bills", "/bills", 1280, 820],
  ["goals", "/goals", 1280, 820],
  ["connect", "/connect-bank", 1280, 820],
  ["charges", "/charges", 1280, 820],
  ["loans", "/loans", 1280, 820],
  ["calendar", "/calendar", 1280, 820],
  ["report", "/report", 1280, 820],
  ["home-phone", "/", 390, 844],
];

mkdirSync("public/landing", { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 2 });
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle2" });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.keyboard.press("Enter")]);
  if (new URL(page.url()).pathname.startsWith("/sign-in")) throw new Error("sign-in failed");

  for (const theme of ["light", "dark"]) {
    // next-themes keeps the choice in localStorage; the page reads it before paint.
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    for (const [name, path, width, height] of SHOTS) {
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.goto(`${base}${path}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 2500)); // streamed sections and count-up animations settle
      const file = `public/landing/${name}-${theme}.png`;
      await page.screenshot({ path: file, type: "png" });
      console.log("wrote", file);
    }
  }
} finally {
  await browser.close();
}
