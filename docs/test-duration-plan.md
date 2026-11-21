# Plan: why the browser tests take so long (2026-11-21)

Status: not executed. Reviewed by Fable (2026-11-21); its findings are folded in.

## Why

`release:prepare` failed twice on 2026-11-21 on timeouts, with no code at fault:

- `view (firefox)` "can handle random changes" (Wordgard's, copied): over 60 s in the full
  `npm test` on React 19, about 2.2 s alone.
- `browser (webkit)` "draws an image as a React widget with state of its own": its
  `vi.waitFor(... "hover")` (`tile.browser.test.ts:1707`) gave up after the 1 s default. It passes
  every run alone.

Both were patched by raising timeouts: the `view` project's `testTimeout` from 60 s to 120 s
(`ecc8b6a`), and three `vi.waitFor` to 10 s (`534d11d`). Those patches hide the problem. This plan
finds where the time goes, so they can be removed.

## What we know

**Vitest's "worker 95%, tests 4%" is not where the time goes.** "Worker" sums each file's
`prepareDuration` (`vitest/dist/chunks/cli-api.*.js`, `sums.worker`). In browser mode, the
orchestrator takes `startTime` once per batch of files and gives it to every iframe
(`@vitest/browser/.../orchestrator-*.js`). Each file is therefore charged the page's age, which
grows with every file. Vitest's own comment says the shares are "not comparable to the wall time".
On CI (React 18), test time sums to about 314 s inside 184 s of wall time, so the tests are the
bulk of the run.

**On CI, there is no contention.** `view (firefox)`'s `webtest-content.ts` takes 7.9 s for the
whole file in the full run, about what it takes alone. `maxWorkers` defaults to
`os.availableParallelism()`, and Vitest's browser pool also uses it as the budget of open pages
shared by the active instances (`vitest/dist/chunks/index.*.js`, `getPageAllowance`). That budget
is 4 on CI and 20 on the local machine (Windows). Locally, all 18 browser instances (6 projects ×
Chromium, Firefox, WebKit) can run at once, each a multi-process browser. When the release failed,
other repositories' test runs and dev servers were running on the same machine.

**Three tests are about 60% of CI's test time** (191 s of 314 s, React 18):

| Test | Runs | Total | Notes |
| --- | --- | --- | --- |
| `svelteRandom` "draw what a fresh editor draws…" | 9 | 92 s | 8–11 s each |
| Wordgard's "can handle random changes" | 18 | 74 s | 0.6–1.4 s plain, 2.5–8.8 s on a view |
| "maps coordinates the same way" (`tile.browser.test.ts:533`) | 11 | 25 s | 0.3 s in most runs, 16.4 s in one (WebKit's 25.9 s file) |

**ReactWordgard costs about 6× plain Wordgard per update.** "Can handle random changes", local,
idle, three runs each, median:

| | Chromium | Firefox |
| --- | --- | --- |
| plain Wordgard (`browser`) | 0.22 s | 0.29 s |
| ReactWordgard, React 18 (`view`) | 1.34 s | 2.23 s |

The test's `render` is `DocTile.create` (`test/wordgard/webtest-content.ts:15`), which is
`ReactDocTile.create` in the `view` project: a new React root per call, but only 200 of them against
10,000 `update` calls. So the cost is per update: a `flushSync` render and commit each time. The
redirect (`packages/react/src/testing/wordgardEditor.ts`) is a two-line re-export, so there is no
harness of ours to blame. These tests run on React's development build. Vue costs the same as React
on CI (view-vue 5.2 / 7.8 / 9.0 s for the file, against 5.1 / 7.9 / 5.4 s), and Svelte 2.6–4.6 s.
That points at the shared core or at a synchronous commit per update, not at React itself.

My first timings, taken once each on a loaded machine, were 2–3× too high. Every number below
comes from three runs or more, reports the median, and records the machine's load.

## Questions

1. **Local contention**: does capping `maxWorkers` keep tests near their time alone in the full
   local run, and at what cost in total time? Is Windows a factor (process priority, antivirus
   scanning browser profiles and Vite's cache)?
2. **The hover flake**: is it starvation, or timer throttling in a page that isn't in front (the
   pool gives an instance more pages as others finish)?
3. **The three dominant tests**: why "maps coordinates the same way" takes 16 s in WebKit against
   0.3 s elsewhere; whether `svelteRandom`'s iteration count is worth 92 s.
4. **The views' cost per update** (6×): how much is the shared core, the framework commit, and the
   development build. Only this one could matter to users.
5. **React 19 against 18**: re-measure back to back first. My earlier 1.5× came from a loaded
   machine.
6. **Redundancy**: 18 runs of Wordgard's tests. Which projects and browsers need all of them is the
   owner's call; this plan gives the cost of each.

## Steps

### 1. `maxWorkers` sweep, locally (question 1)

Full `npm test` with `--maxWorkers` 4, 6, 8 and the default, on React 18 and 19, idle and under a
normal working load (the owner's dev servers running). Record wall time and the slowest "random
changes" and hover test. If a cap fixes it, set it in `vite.config.ts` (or `scripts/release.js`) and
revert the timeouts. Measure with `--reporter=json --outputFile` and a few lines of aggregation. A
script stays only if the later steps keep using it.

### 2. The hover flake (question 2)

Run `tile.browser.test.ts` in WebKit with one page against several pages in the instance, and
under step 1's cap. Find out whether the wait is starvation or throttling before blaming load.

### 3. The three dominant tests (question 3)

- "Maps coordinates the same way" in WebKit: profile it and find what costs 16 s there.
- `svelteRandom`: its cost per iteration against the React and Vue random tests, and whether its
  iteration count can drop without losing coverage.
- Fix what is in our tests. Note what is WebKit's own.

### 4. The views' cost per update (questions 4 and 5)

In `bench/` (which runs through Vitest): random changes on plain Wordgard and on the React, Vue and
Svelte views, the same seed, in production and development builds, React 18 and 19. Profile one
Chromium run. This only places the cost; per "API before performance", fixing the view is a
separate task the owner schedules.

### 5. Findings and fixes

Write up each question's answer here, then the fixes, ranked by time saved. Mark each as ours to do
or the owner's to decide (dropping browsers or projects, a CI worker count). After the agreed fixes,
remove the patches: back to the `view` project's 60 s `testTimeout` and `vi.waitFor`'s default.

## Done when

- Each question has a measured answer, with the numbers in this file.
- With the 2026-11-21 patches removed, `npm run release:prepare` passes three times in a row on the
  owner's machine under its normal working load, and CI passes.
- In those runs, no test takes more than half its timeout.

## Out of scope

- Editing `test/wordgard/` (copied from Wordgard, never edited).
- Performance work on the views themselves: step 4 reports it, the owner schedules it.
