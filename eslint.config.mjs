import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import fsdImportBoundaries from "./eslint/fsd-import-boundaries.mjs";

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
  ]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,mts}"],
    plugins: {
      fsd: {
        rules: {
          "import-boundaries": fsdImportBoundaries,
        },
      },
    },
    rules: {
      "fsd/import-boundaries": "error",
    },
  },
]);

export default eslintConfig;
