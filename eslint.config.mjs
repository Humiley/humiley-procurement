import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ESLint 9 flat config. Replaces .eslintrc.json ({"extends": ["next/core-web-vitals", "next/typescript"]})
// because Next 16 removed `next lint` and eslint-config-next 16 ships flat configs only.
// `npm run check` — and so the Dockerfile's lint gate — runs `eslint .` with this file.
//
// Scope grew: `next lint` only ever linted app/, components/ and lib/. `eslint .` also lints e2e/,
// prisma/, scripts/, tools/, i18n/, types/ and the root config files.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next 16's typescript preset turned these two down from error (Next 14) to warn.
    // Restored: an unused variable or a bare expression statement fails the gate, as before.
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unused-expressions": "error",
    },
  },
  {
    // tools/i18n/*.js are plain CommonJS node scripts (the Dockerfile runs ortho-scan.js directly).
    // typescript-eslint's recommended set now applies to .js files as well as .ts, and its
    // no-require-imports would reject `require` in files that cannot use anything else. They are the
    // only CommonJS files in the repo (tools/i18n/consist.js, tools/i18n/ortho-scan.js; the other
    // scripts and configs are .mjs or .ts), so the exemption covers tools/ only. It stays an error
    // everywhere else — a require() in an app-level .js file fails the gate.
    files: ["tools/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds React Compiler
    // diagnostics to its recommended set. None of them existed in the Next 14 gate. Every one of them
    // that this code base already satisfies stays an error. These four fire on existing code, and
    // are warnings so they are still printed on every `npm run check`:
    //   purity, immutability  4 hits (3 + 1), all in async Server Components, which render once per
    //                         request (Date.now() for "days left" and two inventory date windows;
    //                         a running stock balance built in a .map)
    //   set-state-in-effect   4 hits: mount-time browser feature detection, a vendor-change price
    //                         refill, sidebar group expansion, an FX-rate prefill
    //   refs                  1 hit: SignatureDialog mirrors `busy` into a ref during render
    // This app does not run the React Compiler, which is what these rules protect.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "storage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
