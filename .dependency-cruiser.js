// The published code: `src/` without its tests and test helpers (tsconfig.build.json).
const published = "^src/(?!__tests__/|testing/)";

// The view's core, which any framework's renderer draws for (tile.ts's Renderer): no React in it.
const core = [
  "^src/(RenderedWordgard|tile|changes|composition|reactKeys|viewRoots|wordgardInternals|editorStore|renderStore|words)\\.ts$",
  "^src/decorations/(iterDeco|DecoIterator|decorationHandlers|shapeType|widgetType|wrapperType|markType|nodeWrapperType)\\.ts$",
  "^src/contexts/editorEvents\\.ts$",
  "^src/helpers/elt\\.ts$",
];

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "core-not-to-react",
      comment: "The core reaches React only through a renderer, which React's side gives it.",
      severity: "error",
      from: { path: core },
      to: { path: "^node_modules/(react|react-dom|use-sync-external-store)/", reachable: true },
    },
    {
      name: "vue-not-to-react",
      comment: "vue-wordgard uses the core, not React's side.",
      severity: "error",
      from: { path: "^vue/" },
      to: { path: "^node_modules/(react|react-dom|use-sync-external-store)/", reachable: true },
    },
    {
      name: "no-circular",
      comment:
        "Type-only imports don't run, and ChildNodeViews (React's and Vue's) renders the node and mark views that render it.",
      severity: "error",
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ["type-only"] },
        viaNot: "^(src|vue/src)/components/ChildNodeViews\\.tsx?$",
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
