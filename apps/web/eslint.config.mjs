import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber code changes three.js objects (positions, materials, buffers) every frame, outside React's
    // render, and builds random particle fields once in useMemo. That is how R3F is meant to be used, but React's
    // compiler-oriented rules read it as mutating render state, so they're off for the 3D folders only.
    // LibraryApp owns the "live" camera-journey and growth objects that the 3D scene moves every frame.
    files: ["src/library/world/**", "src/library/three/**", "src/map/**", "src/library/LibraryApp.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
