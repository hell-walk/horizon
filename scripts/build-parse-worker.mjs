// Builds the statement-reading worker into .worker/parse-worker.mjs.
// Runs before `next build` and `next dev` (see package.json). The heavy
// libraries stay external and load from node_modules at runtime.
import { build } from "esbuild";

await build({
  entryPoints: ["src/lib/statements/parse-worker.ts"],
  outfile: ".worker/parse-worker.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pdfjs-dist", "pdfjs-dist/*", "exceljs", "officecrypto-tool", "xlsx"],
  // ExcelJS and friends are CommonJS; give the ESM bundle a require().
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
console.log("built .worker/parse-worker.mjs");
