# react-wordgard: open points (2026-10-31)

Everything still open after R0 to R6, in one place. The steps to a first release are planned in
`docs/partially-executed/v0-release-plan.md`. Each point says where its details are; most
are in `docs/react-wordgard-plan.md` (the plan), by phase or in "Open questions" and "Progress".
Remove a point when it's done or dropped, and say so where its details are.

## Before a v0 release

1. **Publishing.** `"private": true`, version `0.0.0`: the name and scope, the version, and how
   releases are made (the plan's "Our fork's changes": replace the fork's `@stesura` scope, CI and
   staged releases with the library's own).
2. **Consumers need `skipLibCheck`.** Our emitted `ReactWordgard.d.ts` extends a class with a
   private constructor (Wordgard's typings already require it). Worth a line in the README, or
   keeping `ReactWordgard` out of the emitted typings (plan, "Open from the takeover").
3. **A standalone editor flushed from inside React.** `ReactWordgard.create` (its own React root)
   doesn't detect a flush from inside a React render or effect, where React can't commit; a
   hosted editor (`<WordgardEditor>`) refuses it with an error and catches up. Detect it there
   too, or document hosted editors as the supported way (plan, "Open from R1's first slice").
4. **Send the upstream list** to Wordgard's author: `docs/wordgard-upstream-asks.md`, kept in step
   with `docs/wordgard-upstream-bugs.md`. Not sent yet.

## Performance (R6)

- **The timing benchmark on an idle machine on mains power** (`npm run bench`): the numbers in the
  plan come from a machine not confirmed idle.
- **Chunking parked** (not for v0): about 3 ms per keystroke at 15,000 paragraphs, nothing at load
  or when formatting the whole document.
- **Updates that take the slow path:** two edits in one transaction re-walk every plot between
  them. Correct, only slower (plan, R6, "Open from the audit").
- **A development-build profile** (`npm run bench:profile-dev`): the baseline asked for both
  builds; only production was profiled.
- **The timing benchmark's memory column** is unreliable after a ReactWordgard run (the next
  editor shows negative values); `npm run bench:heap` is the one to read.
- **`useEditorMeasure`:** one registered makes every flush run a read and a write pass. Skipping
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

- **React shapes** (R4 slice 6): a React component as a node's shape, owning the element around
  editable content. Only if a case needs it; it would need an `EltTile` subclass that ignores the
  component's own commits outside the flush.
- **Hooks** (plan, R5): node-selected state (`useIsNodeSelected`, `useSelectNode`), composition
  state (`useIsComposingIn`), focus state. An event listener hook isn't needed: Wordgard's
  `Wordgard.domEventHandler` in `config` covers it.
- **Several editors in one paginated layout** (headers, footers, notes): one flush per editor, or
  coordinated flushes so pagination measures them together.
- **Server-side rendering:** a static view, or Wordgard's HTML serializer.
- **Accessibility** of Wordgard's drawn cursor and selection: untested.

## Known differences from Wordgard

The DOM is equivalent in each case; details in the plan, "Open from R1's first slice".

- Attribute order: React writes attributes in prop order and appends added ones, Wordgard's fresh
  render sorts them.
- Shape attributes React sets differently from `setAttribute` (none in Wordgard's schemas):
  `contenteditable=""`, `autofocus`, `checked`, `draggable`, `hidden="until-found"`.
- An empty text leaf with marks is skipped with its wrappers, so `resolve` and `posFromDOM` differ
  at that spot.
- A widget whose DOM is a `<br>` counts as content for the trailing `<br>`.

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
