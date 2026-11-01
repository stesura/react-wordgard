# react-wordgard: plan to a v0 release (2026-10-31)

R0 to R6 are done or settled (`docs/react-wordgard-plan.md`); chunking is parked. This plan is
what's left before publishing a first version, in order. Everything still open after it, release
or not, is in `docs/open-points.md`; keep the two in step. Decisions that are the owner's are
marked **Decide**.

## V1: remove the ProseMirror view (done, 2026-11-01)

`src/prosemirror/` (81 files) was react-prosemirror's view, kept for the demo and the benchmarks
until the Wordgard view replaced it. Done as planned, except:

- **Demo:** the Wordgard demo is the only one, at `/` (`index.html`, `demo/main.tsx`).
- **Benchmarks:** decided: compare against our fork, not the published package, taken from a
  checkout next to this repository (`../react-prosemirror`, or `REACT_PROSEMIRROR_REPO`, with its
  dependencies installed). `bench/vitest.config.ts` aliases `@stesura/react-prosemirror` to its
  `src/index.ts` and `prosemirror-*` to its `node_modules` (the versions the fork is tested with),
  with one React. The bench left the root `tsconfig.json`: `bench/tsconfig.json` types it
  against the checkout (`npm run check:bench`), which CI doesn't have.
- **Helpers:** `findDOMNode`, `refs`, `browser` and `mergeReactProps` removed.
- **Then:** all done. No ProseMirror code is left, so its notice left `THIRD_PARTY_LICENSES.txt`.
  `react-reconciler` and `classnames` went too (dependencies and peers): their only users were
  the removed helpers. That leaves V2 only `wordgard`'s move to the peers.
- **Checks:** `npm run check`, `npm run build`, `npm run check:bench` and `npm run bench:smoke`
  pass; the demo loads with no console errors. `npm test`: 1 failure, the WebKit timeout listed
  in V6, unrelated (it fails alone too).

## V2: package metadata

- **Peer dependencies:** `wordgard`, `react`, `react-dom` (`prosemirror-*` and `react-reconciler`
  went with V1).
- **`wordgard` as a peer, not a dependency:** two copies in one app break Wordgard's own
  `instanceof` checks (a `Transaction`, a `Mark`). A narrow range (`~0.6.2` or exact): we use its
  internals (`src/wordgardInternals.ts`), so a minor version can break us. Keep it a development
  dependency for the tests.
- **Dependencies:** `use-sync-external-store` (the selector hook) stays; `classnames` went with V1.
- **Done when:** `npm pack --dry-run` lists `dist`, the README and the licences only, and a
  scratch app installing the packed tarball next to its own `wordgard` and React builds and runs
  the README's example.

## V3: typings for consumers

`dist/ReactWordgard.d.ts` extends a class whose constructor is private in Wordgard's typings, so
an app without `skipLibCheck` gets errors from our typings (Wordgard's own already need it).

- Check whether the public typings (`dist/index.d.ts` and what it reaches) can avoid naming
  `ReactWordgard`, without casts. If so, do it; otherwise say in the README that `skipLibCheck` is
  needed.
- Check that `Wordgard.DocTile`, which `src/wordgardInternals.ts` adds to Wordgard's typings,
  isn't reachable from the public typings.
- **Done when:** the scratch app from V2 type-checks with `skipLibCheck: false`, or the README
  says it can't.

## V4: the supported way to host an editor

A hosted editor (`<WordgardEditor>` and `<WordgardDoc>`) refuses an update React can't commit (a
flush from inside a React render or effect) with an error, and catches up on its next frame. An
editor with its own React root (`ReactWordgard.create`) doesn't detect it. `src/index.ts` doesn't
export `ReactWordgard`; Wordgard's copied tests use `create`.

- **Decide:** keep `create` internal and document hosted editors as the way (recommended), or
  make it public with the same guard.
- **Done when:** the README says it, and the choice is in `docs/open-points.md`.

## V5: Wordgard's author

- Re-read `docs/wordgard-upstream-asks.md` and send it (the owner sends it). The WebKit
  `moveVertically` item stays out until it's checked in Safari.
- **Done when:** sent; the asks list and `docs/wordgard-upstream-bugs.md` say so.

## V6: checks before publishing

- **Timing benchmark** on an idle machine on mains power (`npm run bench`), its table in the plan's
  R6 section, against the numbers there.
- **The flaky WebKit test:** `tile.browser.test.ts`, "maps coordinates the same way", times out at
  15 s on a loaded machine. Give it a longer timeout if it still fails on an idle one.
- **CI** (`.github/workflows/check.yml`) green on a push, with all three browsers, on React 18
  and 19 (a matrix; the 19 leg installs it over the lockfile). Locally on 19, build, check and
  tests pass, apart from the timeouts under load. Two tests had expected a render error to come
  out of `flushSync`, which React 19 no longer does; they catch it with an error boundary now.
- **README:** install, the peer dependencies, the example, the hooks (with
  `useEditorStateSelector`'s `isEqual`), migrating from react-prosemirror, and what V3 and V4
  decided.
- **Done when:** all of the above, and a CLAUDE.md audit of the release diff.

## V7: publish

- **Decide:** the package name and scope (plain `react-wordgard` if free on npm), the first
  version (`0.1.0` suits an API that can still change), and who publishes: by hand
  (`npm publish`) or from CI on a tag.
- Remove `"private": true`, set the version, publish, tag the commit.
- **Done when:** the package installs from npm into the scratch app from V2.

## After v0

Everything else in `docs/open-points.md`: real Safari and IMEs, React shapes (R4 slice 6), more
hooks (node-selected, composition and focus state), pagination across editors, server-side
rendering, accessibility, chunking (parked), the slow path for two edits in one transaction, and
the known differences from Wordgard.
