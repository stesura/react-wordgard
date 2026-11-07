# Contributing to react-wordgard

## Project setup

This project is written in TypeScript and published as ES modules only. It uses:

- npm for package management;
- tsc to build `dist/` and check types;
- Vitest for tests, most of them in Chromium, Firefox and WebKit through Playwright;
- ESLint and Prettier for linting and formatting;
- dependency-cruiser for the rules on imports (`.dependency-cruiser.js`): no cycles, and no
  development dependencies or test code in the published code.

The source code lives in `src/`, with `src/index.ts` as the public API. How it works is in
`docs/how-it-works.md`.

## Local development

You need Node 22.12 or later. Run `npm install` to install dependencies, and
`npx playwright install chromium firefox webkit` once for the browser tests.

Check types, lint, imports and formatting with `npm run check`, and fix what can be fixed with
`npm run fix`. Build with `npm run build`. Run the tests with `npm test`, and the demo with
`npm run demo`. The lockfile pins React 18: `npm run test:react19` type-checks and tests on React
19, as CI does.

`test/wordgard/` holds Wordgard's own tests, copied unchanged: don't edit them.
`npm run update-wordgard` updates Wordgard and copies them again.

## Version management

Versions follow semver; while on 0.x, a breaking change goes in a minor version. A user-visible
change adds a line to `CHANGELOG.md` under `## Unreleased`, in Wordgard's format: one sentence per
paragraph, under `### Breaking changes`, `### Bug fixes` or `### New features`.

Releasing is described in `RELEASE.md`.

## Security

Report vulnerabilities privately, as `SECURITY.md` says.
