// The published code: each package's `src/` without its tests and test helpers (tsup's entry
// reaches nothing else).
const published = "^packages/[^/]+/src/(?!__tests__/|testing/)";

// The core, which any framework's renderer draws for (tile.ts's Renderer).
const core = "^packages/core/src/";
const frameworks = "^node_modules/(react|react-dom|use-sync-external-store|vue|@vue|svelte)/";

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "core-not-to-frameworks",
      comment: "The core reaches a framework only through a renderer, which the view gives it.",
      severity: "error",
      from: { path: core },
      to: { path: frameworks, reachable: true },
    },
    {
      name: "core-not-to-views",
      comment: "The views depend on the core, not the reverse.",
      severity: "error",
      from: { path: core },
      to: { path: "^packages/(react|vue|svelte)/" },
    },
    {
      name: "vue-not-to-react",
      comment: "vue-wordgard uses the core, not React's side.",
      severity: "error",
      from: { path: "^packages/vue/" },
      to: {
        path: ["^node_modules/(react|react-dom|use-sync-external-store)/", "^packages/react/"],
      },
    },
    {
      name: "react-not-to-vue",
      severity: "error",
      from: { path: "^packages/react/" },
      to: { path: ["^node_modules/(vue|@vue)/", "^packages/vue/"] },
    },
    {
      name: "svelte-not-to-react",
      comment: "svelte-wordgard uses the core, not React's side.",
      severity: "error",
      from: { path: "^packages/svelte/" },
      to: {
        path: ["^node_modules/(react|react-dom|use-sync-external-store)/", "^packages/react/"],
      },
    },
    {
      name: "svelte-not-to-vue",
      severity: "error",
      from: { path: "^packages/svelte/" },
      to: { path: ["^node_modules/(vue|@vue)/", "^packages/vue/"] },
    },
    {
      name: "views-not-to-svelte",
      severity: "error",
      from: { path: "^packages/(react|vue)/" },
      to: { path: ["^node_modules/svelte/", "^packages/svelte/"] },
    },
    {
      name: "views-through-the-core-entry",
      comment:
        "A view reaches the core through its package entry, as it will from npm: the core is published apart.",
      severity: "error",
      from: { path: "^packages/(react|vue|svelte)/src/" },
      to: { path: "^packages/core/src/", pathNot: "^packages/core/src/index\\.ts$" },
    },
    {
      name: "no-circular",
      comment:
        "Type-only imports don't run, and each view's ChildNodeViews renders the node and mark views that render it.",
      severity: "error",
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ["type-only"] },
        viaNot: "^packages/(react|vue|svelte)/src/components/ChildNodeViews\\.tsx?$",
      },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: {
        orphan: true,
        // Test files, and setup files vite.config.ts names, run without being imported.
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)[^/]+\\.config\\.[cm]?[jt]s$",
          "\\.test\\.tsx?$",
          "^test/wordgard-workspace\\.ts$",
          "^scripts/",
        ],
      },
      to: {},
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      comment: "A package the code imports that package.json doesn't list.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "not-to-dev-dep",
      comment:
        "The published code can only use dependencies and peer dependencies (react and wordgard are both peer and development ones).",
      severity: "error",
      from: { path: published },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["npm-peer", "type-only"] },
    },
    {
      name: "published-not-to-tests",
      comment: "The published code can't import tests, test helpers, the demo or the benchmark.",
      severity: "error",
      from: { path: published },
      to: { path: ["^packages/[^/]+/src/(__tests__|testing)/", "^(test|demo|bench)/"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Unchanged copies of Wordgard's tests, run by vite.config.ts.
    exclude: { path: ["^test/wordgard/", "^packages/[^/]+/(dist|\\.svelte-kit)/"] },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    // A package's imports may be listed in its package.json or the root's (the tools).
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["@stesura/source", "import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".cjs", ".mjs", ".svelte"],
    },
  },
};
