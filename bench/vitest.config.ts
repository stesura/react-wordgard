// The benchmarks' own Vitest config, kept apart from `npm test`. React's
// production build unless the mode ends in "development"; modes starting with
// "smoke" run small documents, to check the benchmark works.
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const nodeEnv = mode.endsWith("development") ? "development" : "production";
  // Read by Vite's dependency optimizer, which bundles React.
  process.env.NODE_ENV = nodeEnv;
  return {
    root: fileURLToPath(new URL("..", import.meta.url)),
    // Apart from the tests' cache, which holds React's development build.
    cacheDir: `node_modules/.vite-bench-${nodeEnv}`,
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv) },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "wordgard/doc",
        "wordgard/editor",
        "wordgard/schema",
        "wordgard/state",
        "wordgard/types",
        "prosemirror-model",
        "prosemirror-schema-basic",
        "prosemirror-state",
        "prosemirror-view",
      ],
    },
    test: {
      globals: true,
      include: ["bench/*.bench.test.ts"],
      reporters: ["verbose"],
      testTimeout: 30 * 60 * 1000,
      browser: {
        enabled: true,
        // Exact heap sizes and `gc()`, for the memory column.
        provider: playwright({
          launchOptions: { args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] },
        }),
        headless: true,
        instances: [{ browser: "chromium" }],
      },
    },
  };
});
