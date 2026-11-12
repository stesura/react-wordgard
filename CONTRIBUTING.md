# Contributing to react-wordgard and vue-wordgard

## Project setup

This repository holds three packages, npm workspaces under `packages/`, written in TypeScript and
published as ES modules only:

- `packages/core`, `@stesura/wordgard-view`: the view without a framework, shared by the two below;
- `packages/react`, `@stesura/react-wordgard`;
- `packages/vue`, `@stesura/vue-wordgard`.

Each has its `src/index.ts` as its public API. The views reach the core through its entry only.
`demo/` (with `demo/vue/`), `bench/`, `test/` (Wordgard's copied tests and the shared test setup)
and `scripts/` are the repository's.

It uses:

- npm workspaces for package management, and turbo to run the packages' scripts in order;
- tsup to build each package's `dist/`, and tsc to check types;
- Vitest for tests, most of them in Chromium, Firefox and WebKit through Playwright;
- ESLint and Prettier for linting and formatting;
- dependency-cruiser for the rules on imports (`.dependency-cruiser.js`): no cycles, and no
  development dependencies or test code in the published code.

How it works is in `docs/how-it-works.md`. In the workspace, packages import each other from
their `src` (the `@stesura/source` export condition): nothing needs building to type-check, test
or run the demos.

## Local development

You need Node 22.12 or later. Run `npm install` to install dependencies, and
`npx playwright install chromium firefox webkit` once for the browser tests.

Check types, lint, imports and formatting with `npm run check`, and fix what can be fixed with
`npm run fix`. Build with `npm run build`. Run the tests with `npm test`, and the demos with
`npm run demo` (React) and `npm run demo:vue`. The lockfile pins React 18: `npm run test:react19`
type-checks and tests on React 19, as CI does.

`test/wordgard/` holds Wordgard's own tests, copied unchanged: don't edit them.
`npm run update-wordgard` updates Wordgard and copies them again.

## Version management

The packages are released together, at one version. Versions follow semver; while on 0.x, a
breaking change goes in a minor version. A user-visible change adds a line to the package's
`CHANGELOG.md` under `## Unreleased`, in Wordgard's format: one sentence per
paragraph, under `### Breaking changes`, `### Bug fixes` or `### New features`.

Releasing is described in `RELEASE.md`.

## Security

Report vulnerabilities privately, as `SECURITY.md` says.
