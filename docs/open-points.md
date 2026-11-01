# react-wordgard: open points (2026-11-01)

Everything still open after R0 to R6, in one place. The steps to a first release are planned in
`docs/partially-executed/v0-release-plan.md`. Each point says where its details are; most
are in `docs/react-wordgard-plan.md` (the plan), by phase or in "Open questions" and "Progress".
Remove a point when it's done or dropped, and say so where its details are.

## Before a v0 release

1. **Publishing.** `"private": true`, version `0.0.0`: the name and scope, the version, and how
   releases are made (the plan's "Our fork's changes": replace the fork's `@stesura` scope, CI and
   staged releases with the library's own).
2. **Send the upstream list** to Wordgard's author: `docs/wordgard-upstream-asks.md`, kept in step
   with `docs/wordgard-upstream-bugs.md`. Not sent yet.

## Performance (R6)

- **Chunking parked** (not for v0): about 3 ms per keystroke at 15,000 paragraphs, nothing at load
  or when formatting the whole document.
- **Updates that take the slow path:** two edits in one transaction re-walk every plot between
  them. Correct, only slower (plan, R6, "Open from the audit").
- **A development-build profile** (`npm run bench:profile-dev`): the baseline asked for both
  builds; only production was profiled. Deferred (2026-11-01): not a priority.
- **Filtered timing runs read higher:** `VITE_BENCH_EDITORS=ReactWordgard` gives ReactWordgard
  keystrokes 4–6 ms slower at 15,000 paragraphs than a full `npm run bench`, at any commit
  (2026-11-01). Compare full runs only, or filtered runs only. The keystroke slowdown once noted
  here was mostly this (plan, R6, "Stable inline partitions").
- **The timing benchmark's memory column** is unreliable after a ReactWordgard run (the next
  editor shows negative values); `npm run bench:heap` is the one to read.
- **`useEditorLayoutEffect`:** one registered makes every flush run a read and a write pass. Skipping
  the write when `read` returns the same value was declined for now (it needs an `eq` option;
  adding it later breaks nothing).

## Browsers and input

- **Real Safari and real IMEs**, by hand: the tests emulate composition events (as Wordgard's do)
  and run in Playwright's WebKit, which isn't Safari (plan, "Testing" and R3).
- **Wordgard's `moveVertically` test fails in WebKit** on plain Wordgard too; skipped there
  (`test/skipInBrowser.ts`). Check it in Safari before reporting it (`docs/wordgard-upstream-bugs.md`, 8).
- **A widget next to an IME composition** may be redrawn rather than reused (plan, R4 slice 4).
- **A WebKit test can time out on a busy machine:** `tile.browser.test.ts`, "maps coordinates the
  same way" (many `posAtCoords` calls) passes in about half the runs once the machine is loaded,
  on the code before and after the alignment fix. Raise its timeout if it keeps happening.

## Features not offered yet

- **Accessibility** of Wordgard's drawn cursor and selection: untested. Mostly Wordgard's; ours is
  React decorations' chrome (uneditable) and their components' own ARIA.

## Dropped (2026-11-01)

- **Consumers need `skipLibCheck`:** not ours. A consumer typechecked without it fails only on
  Wordgard's own typings (`editor.d.ts` names a `Decoration.Mark.Type` that doesn't exist); ours
  pass, `ReactWordgard` being internal. The README says so; Wordgard's bug is on the upstream list.
- **A standalone editor flushed from inside React** isn't detected: `ReactWordgard.create` is
  internal (Wordgard's copied tests, the benchmark), and the public `<WordgardEditor>` detects it.
- **React tooltips and panels:** an app positions its own popovers (Floating UI, Radix, Base UI)
  from `coordsAtPos`, as Stesura does; Wordgard's own tooltips and panels work as they are
  (`docs/executed/react-decorations-plan.md`, step 6).
- **Composition and focus hooks:** react-prosemirror's `useIsComposingIn` and `useIsEditorStatic`
  aren't used by Stesura; focus is Wordgard's (`wg.hasFocus`, event listeners).
- **Several editors in one paginated layout:** Stesura's header, footer and note editors are
  created to edit and dropped after, their content kept as HTML; they don't take part in
  pagination.
- **Server-side rendering:** static HTML comes from Wordgard's own serializer, without React.

## Known differences from Wordgard

The DOM is equivalent in each case; details in the plan, "Open from R1's first slice".

- Attribute order: React writes attributes in prop order and appends added ones, Wordgard's fresh
  render sorts them.
- Shape attributes React sets differently from `setAttribute` (none in Wordgard's schemas):
  `contenteditable=""`, `autofocus`, `checked`, `draggable`, `hidden="until-found"`.
- An empty text leaf with marks is skipped with its wrappers, so `resolve` and `posFromDOM` differ
  at that spot.
- A widget whose DOM is a `<br>` counts as content for the trailing `<br>`.
- A node drawn by a React widget has no element around it for its attributes (the selected-node
  class, tag and mark attributes): its component gets them as props, so a selection doesn't
  remount it.

## Limits

- Content React can't draw yet (namespaced shape elements, empty strings in shapes) throws from
  the flush and leaves the editor on its last tree.
- A plot whose type is atomic but whose decorated shape has a content hole would throw ("can't
  render part of"); not reproduced (plan, R4 slices 1–3).
- React widgets (plan, R4 slice 5): the root must be an element; two same-type tag widgets on the
  same side of a sibling are told apart by order; one moving in or out of a wrapper remounts; with
  one in the document, every update walks the old tree to disconnect, as with native widgets.
- Refused updates (plan, R5): `plugin.update` runs twice for their transactions; one uncaught from
  a layout effect unmounts a React 18 root that has no error boundary.
- Wordgard has no `destroy()`, so an editor's React root is never unmounted.
- In development, StrictMode creates a second editor that is never connected.
- Wordgard bugs we mirror or work around: `docs/wordgard-upstream-bugs.md`.

## Internals to watch

- `src/wordgardInternals.ts` augments `wordgard/editor` with `Wordgard.DocTile`: harmless while our
  exported typings don't reference it.
- `ReactWordgard` swaps Wordgard's `DocTile.create` for the length of its base constructor, so
  React draws the first time; Wordgard looking up `DocTile` on the class would remove the swap
  (`docs/wordgard-upstream-asks.md`, 8).
- Subclassing needs two `@ts-expect-error` for Wordgard's private constructor, and its internals
  are typed in one file; a renderer interface from Wordgard would remove both.
