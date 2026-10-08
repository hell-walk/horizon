import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Tutorial code still has a few `any`s; surface them without failing the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
