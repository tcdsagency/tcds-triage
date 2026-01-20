import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled output
    "**/dist/**",
    // Utility scripts (CommonJS)
    "scripts/**",
    // Node.js servers and workers (CommonJS)
    "server/**",
    "worker/**",
    "tcds-workers/**",
    // Browser extension
    "chrome-extension/**",
  ]),
]);

export default eslintConfig;
