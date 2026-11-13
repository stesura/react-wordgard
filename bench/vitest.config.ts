// The benchmarks' own Vitest config, kept apart from `npm test`. React's, Vue's
// and Svelte's production builds unless the mode ends in "development"; modes
// containing "smoke" run small documents, to check the benchmark works, and
// modes starting with "heap" or "profile" run the heap breakdown or the
// CPU profiles instead of the timings.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

import { allocationsStart, allocationsStop } from "./allocations.js";
import { profileStart, profileStop } from "./cpuProfile.js";
import { heapBaseline, heapHeld } from "./heapSnapshot.js";

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const nodeEnv = mode.endsWith("development") ? "development" : "production";
  // Read by Vite's dependency optimizer, which bundles React, and by Vite's
  // `isProduction`, which picks Svelte's build.
  process.env.NODE_ENV = nodeEnv;
  return {
    root,
    // Apart from the tests' cache, which holds React's development build.
    cacheDir: `node_modules/.vite-bench-${nodeEnv}`,
    plugins: [react(), svelte()],
    // The views from their src, as the tests.
    resolve: { conditions: ["@stesura/source", ...defaultClientConditions] },
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
      // Vue's bundler build asks for its feature flags.
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "@handlewithcare/react-prosemirror",
        "vue",
        "wordgard/command",
        "wordgard/doc",
        "wordgard/editor",
        "wordgard/history",
        "wordgard/schema",
        "wordgard/state",
        "wordgard/types",
        "prosemirror-commands",
        "prosemirror-history",
        "prosemirror-model",
        "prosemirror-schema-basic",
        "prosemirror-state",
        "prosemirror-transform",
        "prosemirror-view",
      ],
    },
    test: {
      globals: true,
      include: [
        mode.startsWith("heap")
          ? "bench/heap.bench.test.ts"
          : mode.startsWith("profile")
            ? "bench/profile.bench.test.ts"
            : "bench/editors.bench.test.ts",
      ],
      reporters: ["verbose"],
      testTimeout: 4 * 60 * 60 * 1000,
      browser: {
        enabled: true,
        // Exact heap sizes and `gc()`, for the memory columns.
        provider: playwright({
          launchOptions: { args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] },
        }),
        headless: true,
        instances: [{ browser: "chromium" }],
        commands: {
          allocationsStart,
          allocationsStop,
          heapBaseline,
          heapHeld,
          profileStart,
          profileStop,
        },
      },
    },
  };
});
