// The benchmarks' own Vitest config, kept apart from `npm test`. React's
// production build unless the mode ends in "development"; modes containing
// "smoke" run small documents, to check the benchmark works, and modes
// starting with "heap" or "profile" run the heap breakdown or the keystroke's
// CPU profile instead of the timings.
//
// react-prosemirror is @handlewithcare/react-prosemirror from npm. Stesura's
// fork joins it when a checkout with its dependencies is found
// (../react-prosemirror, or REACT_PROSEMIRROR_REPO): its source, on our copy of
// ProseMirror.
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { allocationsStart, allocationsStop } from "./allocations.js";
import { profileStart, profileStop } from "./cpuProfile.js";
import { heapBaseline, heapHeld } from "./heapSnapshot.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const forkRepo = resolve(root, process.env.REACT_PROSEMIRROR_REPO ?? "../react-prosemirror");
const fork =
  existsSync(resolve(forkRepo, "src/index.ts")) && existsSync(resolve(forkRepo, "node_modules"));

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
        {
          find: "@stesura/react-prosemirror",
          replacement: fork ? `${forkRepo}/src/index.ts` : `${root}/bench/noFork.ts`,
        },
        // One ProseMirror: the fork's source would otherwise get its own.
        { find: /^(prosemirror-[a-z-]+)$/, replacement: `${root}/node_modules/$1` },
      ],
      // One React: the fork's source would otherwise get its own.
      dedupe: ["react", "react-dom"],
    },
    server: { fs: { allow: [root, ...(fork ? [forkRepo] : [])] } },
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
      "import.meta.env.VITE_BENCH_FORK": JSON.stringify(String(fork)),
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "@handlewithcare/react-prosemirror",
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
