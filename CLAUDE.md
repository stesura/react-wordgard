# CLAUDE.md

react-wordgard: a skeleton for a React view over Wordgard (`wordgard` on npm),
derived from react-prosemirror. The plan is `docs/react-wordgard-plan.md`.

- Layout: the Wordgard view is at the root of `src/`. `src/index.ts` exports
  the public API (components, `reactWidget`, hooks); `ReactWordgard` and the
  tile code stay internal.

- Package manager: npm. Node 22.12 or later.
- Build: `npm run build` (tsc, ESM only, to `dist/`).
- Checks: `npm run check` (tsc, ESLint, Prettier); `npm run fix` fixes what it
  can.
- Tests: `npm test` (Vitest). Three projects in `vite.config.ts`: `unit`
  (jsdom, `*.test.ts(x)`), `browser` (Chromium, Firefox and WebKit through
  Playwright, `*.browser.test.ts(x)` and Wordgard's tests; run
  `npx playwright install chromium firefox webkit` once) and `view` (Wordgard's
  tests with their editors created as `ReactWordgard`, same browsers). Copied
  tests failing in one browser on plain Wordgard too: `test/skipInBrowser.ts`.
- Wordgard internals: only `src/wordgardInternals.ts` reaches them (types and
  the `DocTile` handle), plus `src/ReactWordgard.ts` (`declare docTile` and two
  `@ts-expect-error` for Wordgard's private constructor). `test/view/` checks
  that the `view` project really runs on ReactWordgard.
- `test/wordgard/`: Wordgard's browser tests (`webtest-*.ts`) and helpers,
  copied unchanged from the tag matching the installed `wordgard` (`0.6.2`), and
  run by the `browser` project. Don't edit them. `npm run update-wordgard` pins
  the latest `wordgard` and re-copies them; `npm run sync-wordgard-tests`
  re-copies for the installed version (needs `../wordgard`, or `WORDGARD_REPO`).
  Our setup is `test/wordgard-workspace.ts`.
- Demo: `npm run demo` (Vite dev server): `WordgardEditor` in a React app
  (only the schema parts it renders).
- Benchmarks: `npm run bench` and its variants (`bench/`), against our
  react-prosemirror fork from `../react-prosemirror` (or
  `REACT_PROSEMIRROR_REPO`), its dependencies installed. `npm run check:bench`
  type-checks them; CI doesn't, it has no checkout.
- Licensing: LICENSE.txt is MIT, © Edoardo Caratti. Keep the "Copyright (c) The
  New York Times Company" headers on files from react-prosemirror. Code copied
  from another project (react-prosemirror, ProseMirror, Wordgard's tests) needs
  its notice in THIRD_PARTY_LICENSES.txt.
- Commits and pull requests: never add an AI agent (Claude or any other) as a
  co-author or contributor. No `Co-Authored-By` trailers, no "Generated with"
  lines.

## Answers

Keep answers to the point. Be as brief as possible without sacrificing the
message you want to convey.

## Git

Never run `git commit`, and never suggest running it. Committing is the user's
call.

Never run git stash without my explicit authorisation. I would rather you not
use git stash at all, and if you do need it, stop what you're doing and aske me
if you can proceed with the stashing.

## Comments

Keep code comments to the point. Only comment when there's a decision, a
workaround, or something genuinely worth explaining — not to narrate what the
code already says.

If you find yourself writing a lot of comments, step back: it usually means the
design is off and there's a simpler approach.

## Credits

For each file, if they're an exact copy of react-prosemirror, add "taken verbatim from react-prosemirror". If they're an adaptation of react-prosemirror mention it. If the change was only made to fit wordgard, mention it. if it's worth sayigng why, say so. If the modification comes from one of the modifications we made to the react-prosemirror branch used by stesura to improve performance, also mention it.

## Taxonomy

We'll try to get as close as possible to the original react-prosemirror repo taxonomy.
So when you suggest a structure, a folder or file name, try to reuse the same names as react-prosemirror's (only if it makes sense given the names of certain concepts are different in wordgard)

## Finishing work

When a long, multi-point task is done and nothing is left to do, say so and
suggest a commit message.

Commit messages and descriptions should be as short as possible. Never add
yourself as co-author (no `Co-Authored-By` trailer).

## package manager

Use npm rather than pnpm

## Bash

Use bash over powershell.

## authorisation

You don't need my authorisation to run npm i or npm run tests, run the dev
server, run a typecheck or run a build.

## code taxonomy

use arrow functions instead of functions where you can. Do not write inline
imports unless it's for lazy loading reasons.

## react

Avoid the use of useEffect as much as you can. Memoize where it makes sense,
don't be overly aggressive.

## edit automatically

When in edit automatically, if there is a question in my prompt address my
question in chat before writing code. When I ask you to audit, never write code,
just audit and keep the results of you audit concise.

## types

do not typecast. Unless you absolutely need to, in such case you will have to
let me know. Typecasting introduces bugs that are had to track down.

## project status

Project is currently in dev phase, there are no live editors. Migrations and API
changes should therefore not be a concern.

## format

Never run npm run format.

## Plan implementations

When you implement a plan that sits in /docs, at the end of the implementation,
update the plan to mark whether or not it's executed, if anything arose during
its execution or claims didn't hold up, you can mention how we derived from the
plan. If after your work the plan has been entirely executed, move it to
docs/executed, if it was partially executed, move it to docs/partially-executed.
Docs that have been partially executed but whose remaining points have been
deemed not worth pursuing can be put in docs/executed. Remember to mention why
the points were not worth pursuing.

## Handoff

When I ask you to write handoff, write it in chat, don't write in a file.

## Plan implementation - audit loop

When you implement a plan that is in /docs or any large bit of work that
modified a lot of files or was complex; when the work is implemented and your
checks are green:

1. **Launch a Fable audit.** Use the Agent tool with `model: "fable"`, in the
   background. Fable only audits; it must not edit files, commit or stash. It
   has no context, so its prompt must be self-contained:
   - What changed and why: [one paragraph, or "summarise the task above"].
   - The files changed (`git status`, `git diff`).
   - What to scrutinise: [the risky parts, e.g. "edge cases in X, the
     interaction with Y, test fidelity"].
   - Claims to verify, not trust: your test and typecheck results, with counts.
   - The project rules (CLAUDE.md).
   - The output format: findings most severe first, each with file:line, a
     concrete failure scenario, and "confirmed" (traced or run) or "plausible".

2. **Verify each finding yourself.** Don't take the audit on trust: check every
   finding against the code, or by running it. Fix the ones that hold up. Reject
   the rest with a reason. You make all the changes; Fable doesn't.

3. **Re-run your checks** after the fixes. Re-audit only if the fixes were
   substantial.

4. **Update the plan(s)** Mark the elements of plan that are done as being
   executed, if you devieted from the plan explain how and why, if there are
   sill open points or issues you've raised, add them at the bottom of the plan,
   if the plan is partially executed, put it in docs/partially executed, if
   fully executed put it in docs/executed.

5. **Report:**
   - what you implemented;
   - each Fable finding, marked accepted (and fixed) or rejected, with the
     reason;
   - the final check results;
   - a short commit message and a short description;
   - if there is a next step, a handoff prompt for the next agent to take over.
