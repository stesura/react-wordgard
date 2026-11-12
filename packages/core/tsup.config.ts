import { defineConfig } from "tsup";

// ESM only, as Wordgard. Dependencies and peers stay imports.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "es2022",
  // The published types without the tests' (vite/client, vitest/globals).
  dts: { compilerOptions: { types: ["node"] } },
  clean: true,
  external: [/^@stesura\//],
});
