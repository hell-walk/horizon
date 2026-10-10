// Installs the pre-commit check (scripts/check-staged.mjs) into this clone's
// .git/hooks. Runs on "npm install" (the "prepare" script); does nothing where
// there is no git checkout (a host building the app).
import { chmodSync, existsSync, writeFileSync } from "node:fs";

if (!existsSync(".git/hooks")) process.exit(0);

writeFileSync(
  ".git/hooks/pre-commit",
  `#!/bin/sh
# Installed by scripts/install-hooks.mjs: refuses commits that would publish a secret.
node scripts/check-staged.mjs || exit 1
`
);
chmodSync(".git/hooks/pre-commit", 0o755);
console.log("Pre-commit secret check installed.");
