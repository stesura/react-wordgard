/* Copyright (c) The New York Times Company */

import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { type Plugin, defaultClientConditions, defaultServerConditions } from "vite";
import { type TestProjectInlineConfiguration, defineConfig } from "vitest/config";
import type { BrowserCommand, BrowserConfigOptions } from "vitest/node";

// `chromiumFlags` for Chromium's V8: svelte-wordgard's teardown test calls `gc()`.
const browser = (chromiumFlags?: string): BrowserConfigOptions => ({
  enabled: true,
  provider: playwright(),
  headless: true,
  instances: [
    chromiumFlags
      ? {
          browser: "chromium",
          provider: playwright({ launchOptions: { args: [`--js-flags=${chromiumFlags}`] } }),
        }
      : { browser: "chromium" },
    { browser: "firefox" },
    { browser: "webkit" },
  ],
});

// Wordgard's own browser tests, copied unchanged from its repo.
const wordgardTests = "test/wordgard/webtest-*.ts";

const reactWordgardEditor = fileURLToPath(
  new URL("packages/react/src/testing/wordgardEditor.ts", import.meta.url)
);
const vueWordgardEditor = fileURLToPath(
  new URL("packages/vue/src/testing/wordgardEditor.ts", import.meta.url)
);
const svelteWordgardEditor = fileURLToPath(
  new URL("packages/svelte/src/testing/wordgardEditor.ts", import.meta.url)
);

// Has the copied tests import `editor` in place of wordgard/editor.
const redirectWordgardTests = (name: string, editor: string): Plugin => ({
  name,
  enforce: "pre",
  resolveId: (source, importer) =>
    source === "wordgard/editor" && importer?.replaceAll("\\", "/").includes("/test/wordgard/")
      ? editor
      : null,
});

// Renders a module's default export on the server, through the project's Vite server, compiled as
// SvelteKit compiles it there: svelte-wordgard's server rendering test.
const renderOnServer: BrowserCommand<[file: string]> = async ({ project }, file) => {
  const { default: render } = await project.vite.ssrLoadModule(file);
  if (typeof render != "function") throw new Error(`${file} exports no function to render`);
  return render();
};

// As test/view-svelte/build.test.ts's `svelteBuild`.
type SvelteBuild = "development" | "production" | "async" | "async-production";

// Wordgard's tests again, with their editors created as SvelteWordgard, and the Svelte view's own,
// for each way an app compiles Svelte: the view relies on Svelte's behaviour, and its DOM differs
// between them (the Svelte plan's "Testing across Svelte's builds and releases"). Not extending
// the root's config: its `development` condition would win over `production` (Svelte's `DEV`, from
// esm-env).
const svelteProject = (name: string, build: SvelteBuild): TestProjectInlineConfiguration => {
  const mode = build.includes("production") ? "production" : "development";
  return {
    extends: false,
    plugins: [
      svelte({
        compilerOptions: {
          dev: mode == "development",
          experimental: { async: build.startsWith("async") },
        },
      }),
      redirectWordgardTests(`wordgard-tests-on-svelte-wordgard-${build}`, svelteWordgardEditor),
    ],
    resolve: { conditions: ["@stesura/source", "module", "browser", mode] },
    ssr: { resolve: { conditions: ["@stesura/source", "module", "node", mode] } },
    build: { target: "esnext" },
    optimizeDeps: {
      include: [
        "wordgard/schema",
        "wordgard/history",
        "wordgard/table",
        "axe-core",
        // Not used here, but found mid-run in `npm test` (not in a Svelte project run alone), which
        // reloads the browser tests on a cold cache.
        "react",
        "react-dom",
        "react-dom/client",
        "use-sync-external-store/with-selector",
      ],
    },
    test: {
      name,
      globals: true,
      include: [
        wordgardTests,
        "test/view-svelte/*.test.ts",
        "packages/svelte/src/**/*.browser.test.ts",
      ],
      testTimeout: 60_000,
      // React's pending list, less what the Svelte view passes.
      setupFiles: [
        "test/wordgard-workspace.ts",
        "test/skipInBrowser.ts",
        "test/view-svelte/skipPending.ts",
      ],
      browser: { ...browser("--expose-gc"), commands: { renderOnServer } },
      // For test/view-svelte/build.test.ts.
      provide: { svelteBuild: build },
    },
  };
};

// Serves the demo (`npm run demo`) and configures the tests (`npm test`).
export default defineConfig({
  plugins: [react()],
  // The workspace packages from their src, not their dist (their exports' first condition): the
  // tests run on the working tree. Vitest runs the jsdom tests through the server's resolution.
  resolve: { conditions: ["@stesura/source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["@stesura/source", ...defaultServerConditions] } },
  build: {
    target: "esnext",
  },
  // Found mid-run otherwise, which reloads the browser tests.
  optimizeDeps: {
    include: [
      "wordgard/schema",
      "wordgard/history",
      "wordgard/table",
      "use-sync-external-store/with-selector",
      "react",
      "react-dom",
      "react-dom/client",
      "axe-core",
      // `vue` in the `view-vue` project.
      "vue/dist/vue.esm-bundler.js",
    ],
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["packages/*/src/**/*.test.{ts,tsx}"],
          exclude: ["packages/*/src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["packages/{core,react}/src/**/*.browser.test.{ts,tsx}", wordgardTests],
          setupFiles: ["test/wordgard-workspace.ts", "test/skipInBrowser.ts"],
          browser: browser(),
        },
      },
      {
        // Wordgard's tests again, with their editors created as ReactWordgard.
        extends: true,
        plugins: [redirectWordgardTests("wordgard-tests-on-react-wordgard", reactWordgardEditor)],
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
      {
        // Wordgard's tests again, with their editors created as VueWordgard, and
        // the Vue view's own.
        extends: true,
        plugins: [redirectWordgardTests("wordgard-tests-on-vue-wordgard", vueWordgardEditor)],
        // The build with Vue's template compiler: the tests' components are
        // templates, as users' are.
        resolve: { alias: [{ find: /^vue$/, replacement: "vue/dist/vue.esm-bundler.js" }] },
        // Vue's bundler build asks for its feature flags.
        define: {
          __VUE_OPTIONS_API__: "true",
          __VUE_PROD_DEVTOOLS__: "false",
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
        },
        test: {
          name: "view-vue",
          include: [
            wordgardTests,
            "test/view-vue/*.test.ts",
            "packages/vue/src/**/*.browser.test.ts",
          ],
          testTimeout: 60_000,
          // The pending list is React's: Vue fails the same two "reparent" tests.
          setupFiles: [
            "test/wordgard-workspace.ts",
            "test/skipInBrowser.ts",
            "test/view/skipPending.ts",
          ],
          browser: browser(),
        },
      },
      svelteProject("view-svelte", "development"),
      svelteProject("view-svelte-production", "production"),
      svelteProject("view-svelte-async", "async"),
      // Weekly (svelte-latest.yml) and on demand, not in `npm test`: each of its two differences
      // from development runs on its own above.
      ...(process.env.SVELTE_ASYNC_PRODUCTION
        ? [svelteProject("view-svelte-async-production", "async-production")]
        : []),
    ],
  },
});
