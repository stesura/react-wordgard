# Plan: why the browser tests take so long (2026-11-21)

Status: partially executed (2026-11-21). Steps 1–5 are done: see "Findings" at the bottom. What's
left is the owner's: `release:prepare` three times and CI, and question 6.

Reviewed by Fable (2026-11-21); its findings are folded in.

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

## Findings (2026-11-21)

Measured on the owner's machine (Windows 11, 20 logical cores, 24 GB), React 18 unless said, with
a reporter that records each test's project and duration (Vitest's JSON has no project). "Load" is
the CPU load sampled every 10 s during the run, the run's own included: about 60% for a run at 6
workers on an idle machine. "Under load" adds six processes each keeping a core busy, standing in
for another repository's tests: 83–87%.

### 1. Local contention: Vitest's default runs out of memory

Full `npm test`, three runs each, median wall time:

| `maxWorkers` | Wall (runs) | Failed runs |
| --- | --- | --- |
| 4 | 302 s (315, 302, 255) | 0 of 3 |
| 6 | 258 s (275, 258, 236) | 0 of 3 |
| 8 | 332 s (332, 305, 343) | 0 of 3 |
| default (19) | 229–603 s | 3 of 3 |
| 6, under load | 470 s (470, 452, 500) | 0 of 3 |
| default, under load | 283 s, aborted | 1 of 1 |
| 6, React 19 | 269 s (319, 269, 253) | 0 of 3 |

The default runs failed with "Failed to connect to the browser session" (all six Firefox instances
in one run: 107 of 387 files never ran), "The firefox page crashed… ran out of memory", "out of
memory" inside tests, and timeouts of `svelteRandom` (60 s) and "can handle random changes" (up to
89 s). At 19 workers, all 18 browser instances (each several processes) are open at once: memory
gives out first, then CPU. At 4–8 workers nothing failed in 12 runs. Six is the fastest.

The slowest of the watched tests at 6 workers, across three runs (timeout in brackets):

| Test | Idle | Under load | React 19 |
| --- | --- | --- | --- |
| "can handle random changes" [60 s] | 8.1 s | 15.8 s | 24.7 s |
| `svelteRandom` [60 s] | 20.0 s | 32.9 s | 17.8 s |
| "maps coordinates the same way" [60 s] | 14.8 s | 24.4 s | 21.9 s |
| the hover test, whole | 1.1 s | 2.0 s | 0.9 s |

Windows itself (process priority, antivirus) was not isolated: with the cap, nothing needs it.

### 2. The hover flake: WebKit's coarse task loop, starved

A probe in the `browser` project timed, 20 times in each browser: the hover commit (React's
`mouseover` update, scheduled through a `MessageChannel`), `setTimeout(0)` and a `MessageChannel`
message. Every page was `visible` and focused in every run: no background-page throttling.

| WebKit, ms | Hover commit | `setTimeout(0)` | Message |
| --- | --- | --- | --- |
| Alone (3 runs) | median 32, max 35 | 14 | 31 |
| Full run, 6 workers, React 19 (3 runs) | median 48–102, max 159 | 16–17 | 31–57 |
| Full run, 6 workers, under load (3 runs) | median 36–147, max 344 | 14–29 | 32–63 |

Chromium and Firefox commit in 1–2 ms (max 12). Playwright's WebKit on Windows runs a task a
15.6 ms timer tick late at best, even alone, and React's commit takes two of them. Under load the
ticks starve further. With the cap, the worst commit took a third of `vi.waitFor`'s 1 s default.
The 1 s timeout in `release:prepare` came with 19 workers and other test runs on the machine.

### 3. The three dominant tests

**"Maps coordinates the same way", "on wrapped lines", in WebKit.** Wordgard's
`TextTile.posAtCoordsInner` measures a Range rect for each character of the text node, so a call
is linear in the paragraph's length. In WebKit a call takes 1.2–1.5 ms on that 228-character
paragraph, against 0.02 ms on "hello"; Chromium 0.4 ms, Firefox 0.14 ms. The test made about
6,500 calls (two editors, a point every 5 px across and 3 px down): 8–9 s alone, 11–24 s in full
runs, the same on plain Wordgard and ReactWordgard. Ours: the grid. Wordgard's and WebKit's: the
cost per call, which a user clicking in a long paragraph in Safari pays too.

**`svelteRandom`.** 20 seeds of 30 steps, each step drawing two fresh editors to compare against:
0.1–0.6 s a seed alone (5–7 s a run), 9–33 s in full runs, in nine runs (three Svelte projects ×
three browsers): about a third of a 6-worker run's test time (117 s of 345 s). The first seed
alone reaches all five kinds of component the test asserts on; more seeds add edit sequences, not
kinds. There is no React or Vue counterpart; Wordgard's own random test costs 2–3 s a run.

### 4. The views' cost per update

Wordgard's "can handle random changes" loop (100 documents × 100 random changes, seeded, the same
in every view) on each view's `Wordgard.DocTile`, in a temporary Vitest config, Chromium and
Firefox in parallel, three runs, median ms per update:

| | Wordgard | Svelte | Vue | React 18 | React 19 |
| --- | --- | --- | --- | --- | --- |
| Development, Chromium | 0.039 | 0.173 | 0.292 | 0.341 | 0.213 |
| Development, Firefox | 0.040 | 0.182 | 0.350 | 0.340 | 0.499 |
| Production, Chromium | 0.033 | 0.173 | 0.220 | 0.176 | 0.092 |
| Production, Firefox | 0.029 | 0.160 | 0.211 | 0.205 | 0.116 |

In production the views cost 3–7× plain Wordgard per update. Svelte costs the same in both builds,
so about 0.13 ms per update is the shared core. A Chromium CPU profile (production, one run, 50 µs
sampling) of the React view's updates: of 900 ms in `updateRanges`, React's commit (`flushSync`)
takes 408 ms, the core's layout 252 ms, its decoration walk (`iterDeco`) 234 ms and building
171 ms (nested, so they overlap), and GC about 15%. Svelte's has the same shape (commit 362 ms,
layout 222 ms, `iterDeco` 209 ms). Roughly half is the shared core's walk and layout, two fifths
the framework's synchronous commit. Per "API before performance", fixing it is the owner's to
schedule.

### 5. React 19 against 18

Back to back, idle, 6 workers: the same wall time (269 s against 258 s). React 19's development
build is faster in Chromium (0.213 against 0.341 ms per update) and slower in Firefox (0.499
against 0.340): hence "can handle random changes" on the `view` project in Firefox is React 19's
slowest test (21–25 s in full runs, about 5 s alone). Its production build is twice as fast as 18's.

### 6. Redundancy

Not decided here. The copied Wordgard tests run in 6 projects × 3 browsers; the per-test numbers
above give their cost.

### Fixes, by time saved

1. Ours, done: `maxWorkers` capped at 6 in `vite.config.ts` (`Math.min(6, default)`, so CI's
   default stays), in every project: Vitest refuses projects with different `maxWorkers`, and the
   Svelte projects don't extend the root config. Locally: from 3 failed runs of 3 to 12 passed of
   12.
2. Ours, done: `svelteRandom` down to 10 seeds, halving about a third of the test time. The owner
   may prefer the breadth of 20.
3. Ours, done: "maps coordinates the same way" samples every 6 px down instead of 3 (still three
   points a line), halving its calls.
4. Ours, done: the 2026-11-21 patches removed: the `view` project's `testTimeout` back to 60 s, the
   three `vi.waitFor` back to the 1 s default.
5. The owner's: the cost per update (step 4), Wordgard's per-character `posAtCoords` (an upstream
   ask, with WebKit's numbers), dropping projects or browsers (question 6).

### Deviations from the plan

- Step 4 ran in a temporary Vitest config and test, not in `bench/`. They and every probe were
  deleted: no later step uses them.
- The "normal working load" is synthetic (six busy cores), not the owner's dev servers: idle dev
  servers barely load the machine, and the failure came with other test runs.
- `release:prepare` was not run (it sets versions and CHANGELOGs); its tests were. See
  "Verification".

### Verification

With the fixes, the patches removed and no `--maxWorkers` flag (the config's cap):

| Run | Wall | Result | Slowest test [timeout] |
| --- | --- | --- | --- |
| `npm test`, idle | 201 s | 7,144 passed or skipped | 9.3 s, coordinates, WebKit [60 s] |
| `npm test`, idle | 265 s | 7,144 passed or skipped | 9.0 s, `svelteRandom`, Firefox [60 s] |
| `npm test`, under load | 457 s | 7,144 passed or skipped | 15.0 s, `svelteRandom`, Firefox [60 s] |
| `npm run test:react19` | 332 s | 387 files passed | — |

No test took more than a quarter of its timeout. The three `vi.waitFor` tests, whole: hydration
0.8–2.6 s (with a Vite server started; 60 s), the Svelte outro 0.4–0.7 s, the hover test
0.3–0.7 s. `npm run check` passes.

### Open points

- The owner: `npm run release:prepare` three times in a row under a normal working load, and CI.
- Question 6.
- "Maps coordinates the same way" keeps its own 60 s timeout (from 0.1.0, not one of the
  2026-11-21 patches).
