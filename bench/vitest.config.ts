// The benchmarks' own Vitest config, kept apart from `npm test`. React's
// production build unless the mode ends in "development"; modes containing
// "smoke" run small documents, to check the benchmark works, and modes
// starting with "heap" or "profile" run the heap breakdown or the keystroke's
// CPU profile instead of the timings.
//
// react-prosemirror and ProseMirror come from a react-prosemirror checkout
// (our fork, ../react-prosemirror or REACT_PROSEMIRROR_REPO): its source, and
// the ProseMirror packages it's tested with, from its node_modules.
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { profileStart, profileStop } from "./cpuProfile.js";
import { heapBaseline, heapHeld } from "./heapSnapshot.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const reactProseMirror = resolve(
  root,
  process.env.REACT_PROSEMIRROR_REPO ?? "../react-prosemirror"
);
if (!existsSync(resolve(reactProseMirror, "node_modules/prosemirror-view")))
  throw new Error(
    `No react-prosemirror checkout with its dependencies installed at ${reactProseMirror}`
  );

export default defineConfig(({ mode }) => {
  const nodeEnv = mode.endsWith("development") ? "development" : "production";
  // Read by Vite's dependency optimizer, which bundles React.
  process.env.NODE_ENV = nodeEnv;
  return {
    root,
    // Apart from the tests' cache, which holds React's development build.
    cacheDir: `node_modules/.vite-bench-${nodeEnv}`,
    plugins: [react()],
    resolve: {
      alias: [
        { find: "@stesura/react-prosemirror", replacement: `${reactProseMirror}/src/index.ts` },
        { find: /^(prosemirror-[a-z-]+)$/, replacement: `${reactProseMirror}/node_modules/$1` },
      ],
      // One React: react-prosemirror's source would otherwise get its own.
      dedupe: ["react", "react-dom"],
    },
    server: { fs: { allow: [root, reactProseMirror] } },
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
      include: [
        mode.startsWith("heap")
          ? "bench/heap.bench.test.ts"
          : mode.startsWith("profile")
            ? "bench/profile.bench.test.ts"
            : "bench/editors.bench.test.ts",
      ],
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
        commands: { heapBaseline, heapHeld, profileStart, profileStop },
      },
    },
  };
});
