# Contributing to react-wordgard

How to work on the library itself; the README is for those using it. How the library works is in
`docs/how-it-works.md`, what's still open in `docs/open-points.md`.

## Project setup

The library is written in TypeScript and published as ES modules only. It uses:

- [npm](https://docs.npmjs.com/) for packages, with the lockfile committed;
- [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) to build `dist/`
  (JavaScript and type declarations, from `tsconfig.build.json`) and to check types;
- [Vitest](https://vitest.dev/) for the tests, in a browser through
  [Playwright](https://playwright.dev/) (Chromium, Firefox and WebKit) for all but a few;
- [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) for linting and formatting;
- [Vite](https://vite.dev/) for the demo.

Where things are:

- `src/`: the library. `src/index.ts` is the public API; everything else is internal.
  `src/tile.ts` and `src/ReactWordgard.ts` are the core (React drawing inside Wordgard's update,
  Wordgard's tiles built over React's DOM), `src/components/` what React renders,
  `src/decorations/` the layout and the React decorations, `src/hooks/` and `src/contexts/` the
  hooks. Tests are in `src/__tests__/`, their helpers in `src/testing/`.
- `test/wordgard/`: Wordgard's own browser tests, copied (below).
- `skills/react-wordgard/SKILL.md`: the skill for users' AI agents, shipped in the package.
- `demo/`: the demo, `bench/`: the benchmark, `scripts/`: maintenance scripts.
- `docs/`: how it works (`how-it-works.md`), what's open (`open-points.md`), and the Wordgard
  bugs and requests the code works around (`wordgard-upstream-bugs.md`).

## Local development

You need Node 22.12 or later (`.nvmrc`; the library itself runs wherever React and Wordgard do).

```sh
npm install
npx playwright install chromium firefox webkit  # once, for the browser tests
npm run build                                   # dist/
npm run check                                   # types, lint, format
npm run fix                                     # fixes what lint and format can
npm test                                        # every test, in every browser
npm run demo                                    # the demo, on Vite's dev server
npm run demo:preview                            # the demo built for production, served
```

### Tests

`vite.config.ts` defines three Vitest projects:

- `unit`: `*.test.ts(x)` in jsdom (`npm run test:unit`);
- `browser`: `*.browser.test.ts(x)` and Wordgard's copied tests, in Chromium, Firefox and WebKit
  (`npm run test:browser`);
- `view`: Wordgard's copied tests again, with their editors created as react-wordgard's, so they
  run against our view (`npx vitest run --project view`). `test/view/` checks that they really
  do.

To run one file or one browser: `npx vitest run --project browser --browser.name=webkit
src/__tests__/reactShape.browser.test.tsx`. Many tests compare react-wordgard's DOM and Wordgard's
view tree with plain Wordgard's, or with a fresh editor's, after each change.

A full run can fail to load a file right after the dependencies change, while Vite rebuilds its
cache; run it again.

### Wordgard's tests and versions

`test/wordgard/` holds Wordgard's browser tests (`webtest-*.ts`) and their helpers, copied
unchanged from the tag of the installed `wordgard`: don't edit them. A test that fails in one
browser on plain Wordgard too is listed in `test/skipInBrowser.ts`; our own setup for them is in
`test/wordgard-workspace.ts`.

- `npm run update-wordgard` pins the newest `wordgard` as the development dependency, sets the
  peer range to its patches, and copies its tests again.
- `npm run sync-wordgard-tests` copies them again for the installed version (needs Wordgard's
  repository next to this one, `../wordgard`, or `WORDGARD_REPO`).

The library reaches into Wordgard's internals; `src/wordgardInternals.ts` is the only file that
types them. After a Wordgard update, re-read it against the new version.

### The benchmark

```sh
npm run bench          # times ReactWordgard, Wordgard, react-prosemirror and ProseMirror
npm run bench:heap     # what each editor holds in the heap, by class
npm run bench:profile  # where load's and a keystroke's time go, by function
npm run check:bench    # the benchmark's types
```

The benchmark (`bench/`, not part of the package) times load, a keystroke and bolding the whole
document, and measures the memory each loaded editor holds, at 2,500 and 15,000 paragraphs. It
uses React's production build; `npm run bench:dev` uses the development build and
`npm run bench:smoke` checks it runs; `npm run bench:heap` breaks the memory down by class, from
heap snapshots. `VITE_BENCH_EDITORS=ReactWordgard` runs only the editors named
(comma-separated); compare full runs with full runs, filtered with filtered. Run it on an idle
machine, on mains power. An editor holding over 1 GB skips the whole-document format: Chromium caps
a page's heap at 4 GB, and react-prosemirror runs out of it there at 15,000 paragraphs with inline
nodes.

It takes react-prosemirror and ProseMirror from a checkout of our fork next to this repository
(`../react-prosemirror`, or `REACT_PROSEMIRROR_REPO`), with its dependencies installed. The fork
([stesura/react-prosemirror](https://github.com/stesura/react-prosemirror)) changes upstream for
large documents:

- Node, mark, text and widget views place their view description among their siblings with a
  binary search instead of re-sorting the sibling list.
- The `reactKeys` plugin keeps its key tables for transactions that only change attributes or
  node marks.
- `<ProseMirror>` takes an opt-in `stableContexts` prop.
- A node view's first render decides `contentEditable` from the schema.
- `ReactEditorView` detaches the React-rendered children around the base constructor's attribute
  changes.

## Conventions

- **Wordgard's API first.** react-wordgard draws Wordgard with React; it isn't a compatibility
  layer for react-prosemirror. Names follow Wordgard's concepts; React decorations keep
  react-prosemirror's prop names (`nodeProps`, `contentDOMRef`) so node views port easily.
- **No typecasts.** Narrow with checks; the two `@ts-expect-error` for Wordgard's private
  constructor in `src/ReactWordgard.ts` are the exception.
- **Arrow functions**, few comments (decisions and workarounds, not what the code says), no
  `useEffect` where it can be avoided.
- **Credits and licences.** A file taken from react-prosemirror says so in its header ("taken
  verbatim from react-prosemirror", or how it was adapted) and keeps its "Copyright (c) The New
  York Times Company" line where it had one. Code copied from another project needs its notice in
  `THIRD_PARTY_LICENSES.txt`.
- **Tests with every change**, in the three browsers, and the full suite green.
- **The agent skill** (`skills/react-wordgard/SKILL.md`) follows the API: a change to the API,
  its rules or its error messages updates it, and its examples must compile.
- **The changelog**: a user-visible change (the API, behaviour, a fix, the peer ranges) adds a
  line to `CHANGELOG.md` under `## Unreleased`, in Wordgard's format: one sentence per paragraph,
  under `### Breaking changes`, `### Bug fixes` or `### New features`.

## Continuous integration

`.github/workflows/check.yml` runs on every push and pull request: build, `npm run check` and
`npm test`, on React 18 and on React 19, and once against the newest `wordgard` patch in the peer
range, since the library uses Wordgard's internals.

## Releases

Versions follow semver; while on 0.x, a breaking change goes in a minor version. CI runs on pull
requests and by hand, not on every push; a release runs it on the release commit. To release, on
`master`, logged in to npm (`npm whoami`) and GitHub (`gh auth status`):

1. `npm run release:prepare -- <version>`: renames `## Unreleased` in `CHANGELOG.md` to the
   version and date, sets the version in `package.json`, and runs the checks and tests.
2. Commit and push.
3. `npm run release:publish`: runs CI on that commit and waits for it, asks before publishing to
   npm (a version can't be published twice), then tags the commit (`v<version>`), pushes the tag,
   creates the GitHub release from the changelog section, and deploys the demo.

## Security

Report vulnerabilities privately, as `SECURITY.md` says, not in a public issue.
