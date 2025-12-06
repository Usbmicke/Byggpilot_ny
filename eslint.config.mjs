import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

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
  // **Viktig säkerhetsregel för att förhindra server-kod på klienten**
  {
    "rules": {
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["src/lib/dal/*", "firebase-admin", "server-only"],
              "message": "Server-side modules (DAL, firebase-admin, server-only) must NOT be imported in client components."
            }
          ]
        }
      ]
    },
    // Denna regel ska gälla alla filer...
    "files": ["src/**/*.{ts,tsx}"],
    // ...förutom de som är avsedda att köras på servern.
    "ignores": ["src/genkit/**", "src/app/api/**"]
  }
]);

export default eslintConfig;
