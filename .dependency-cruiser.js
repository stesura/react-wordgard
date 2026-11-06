// The published code: `src/` without its tests and test helpers (tsconfig.build.json).
const published = "^src/(?!__tests__/|testing/)";

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Type-only imports don't run, and ChildNodeViews renders the node and mark views that render it.",
      severity: "error",
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ["type-only"] },
        viaNot: "^src/components/ChildNodeViews\\.tsx$",
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
      to: { path: ["^src/(__tests__|testing)/", "^(test|demo|bench)/"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Unchanged copies of Wordgard's tests, run by vite.config.ts.
    exclude: { path: "^test/wordgard/" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".cjs", ".mjs"],
    },
  },
};
