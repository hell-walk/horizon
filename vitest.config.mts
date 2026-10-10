import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      // "server-only" throws outside a React Server build; tests import server modules directly.
      "server-only": path("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
          // Reading real PDF and Excel statements takes seconds, and over a minute
          // on a busy machine (a build or server running alongside): generous, so
          // only a real hang fails.
          testTimeout: 180_000,
        },
      },
      {
        // Black-box tests against a running Horizon (see tests/security/README.md).
        extends: true,
        test: {
          name: "security",
          include: ["tests/security/**/*.test.ts"],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
