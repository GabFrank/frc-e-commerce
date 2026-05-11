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
  ]),
  {
    // Reglas del React Compiler son muy estrictas con patterns legacy
    // (setState dentro de useEffect, derived state, etc.). Las dejamos
    // como warning para no bloquear CI mientras consolidamos código —
    // refactorizar a useEffect-free / derived state es un work paralelo.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
