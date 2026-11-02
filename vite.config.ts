/* Copyright (c) The New York Times Company */

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import type { BrowserConfigOptions } from "vitest/node";

const browser = (): BrowserConfigOptions => ({
  enabled: true,
  provider: playwright(),
  headless: true,
  instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
});

// Wordgard's own browser tests, copied unchanged from its repo.
const wordgardTests = "test/wordgard/webtest-*.ts";

const reactWordgardEditor = fileURLToPath(
  new URL("src/testing/wordgardEditor.ts", import.meta.url)
);

// Serves the demo (`npm run demo`) and configures the tests (`npm test`).
export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
  },
  // Found mid-run otherwise, which reloads the browser tests.
  optimizeDeps: {
    include: ["wordgard/schema", "wordgard/history", "use-sync-external-store/with-selector"],
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}", wordgardTests],
          setupFiles: ["test/wordgard-workspace.ts", "test/skipInBrowser.ts"],
          browser: browser(),
        },
      },
      {
        // Wordgard's tests again, with their editors created as ReactWordgard.
        extends: true,
        plugins: [
          {
            name: "wordgard-tests-on-react-wordgard",
            enforce: "pre",
            resolveId: (source, importer) =>
              source === "wordgard/editor" &&
              importer?.replaceAll("\\", "/").includes("/test/wordgard/")
                ? reactWordgardEditor
                : null,
          },
        ],
        test: {
          name: "view",
          include: [wordgardTests, "test/view/*.test.ts"],
          // Wordgard's "can handle random changes" draws 100 random documents:
          // on ReactWordgard, in CI's Firefox, past the 15 s default.
          testTimeout: 60_000,
          setupFiles: [
            "test/wordgard-workspace.ts",
            "test/skipInBrowser.ts",
            "test/view/skipPending.ts",
          ],
          browser: browser(),
        },
      },
    ],
  },
});
