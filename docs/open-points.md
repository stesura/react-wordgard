# react-wordgard: open points (2026-11-01)

What's still open, in one place: before a release, performance, browsers and input, features,
the known differences from Wordgard, limits, and what to watch in Wordgard's internals. Remove a
point when it's done or dropped.

## Before a v0 release

1. **Publishing:** prepared (`react-wordgard` `0.1.0`, by hand); the owner pushes for CI,
   publishes and tags (`CONTRIBUTING.md`, "Releases").
2. **Send the upstream list** to Wordgard's author: the bugs and requests in
   with `docs/wordgard-upstream-bugs.md`. Not sent yet.

## Performance

- **Chunking:** Phase 2 of `docs/partially-executed/per-node-update.md`, deferred. Since Phase 1
  a keystroke renders no list but the text's, but React still clones the fibers of the edited
  node's siblings, and Enter or a paste renders the whole parent list.
- **Updates that take the slow path:** two edits in one transaction re-walk every plot between
  them. Correct, only slower.
- **A development-build profile** (`npm run bench:profile-dev`): the baseline asked for both
  builds; only production was profiled. Deferred (2026-11-01): not a priority.
- **Filtered timing runs read higher:** `VITE_BENCH_EDITORS=ReactWordgard` gives ReactWordgard
  keystrokes 4–6 ms slower at 15,000 paragraphs than a full `npm run bench`, at any commit
  (2026-11-01). Compare full runs only, or filtered runs only. The keystroke slowdown once noted
  here was mostly this.
- **The timing benchmark's memory column** is unreliable after a ReactWordgard run (the next
  editor shows negative values); `npm run bench:heap` is the one to read.
- **`useEditorLayoutEffect`:** one registered makes every flush run its read. A read returning
  `undefined` skips its write, and with no write due none is scheduled (2026-11-02); there's no
  `eq` option.

## Browsers and input

- **Real Safari and real IMEs**, by hand: the tests emulate composition events (as Wordgard's do)
  and run in Playwright's WebKit, which isn't Safari. Two steps up:
  Chrome's DevTools protocol (`Input.imeSetComposition`, `Input.insertText`, reachable from
  Vitest's browser mode in Chromium) drives the browser's own composition handling, so a few
  composition tests could run on it; and a checklist by hand on the demo (Japanese and Pinyin IMEs
  on Windows Chrome and macOS Safari, Android Gboard, iOS autocorrect), inside React shapes and
  marks while their chrome changes.
- **Wordgard's `moveVertically` test fails in WebKit** on plain Wordgard too; skipped there
  (`test/skipInBrowser.ts`). Check it in Safari before reporting it (`docs/wordgard-upstream-bugs.md`, 8).
- **A widget next to an IME composition** may be redrawn rather than reused.


## Features not offered yet

- **Accessibility:** axe-core runs over editors with React shapes, marks and widgets, and finds
  nothing plain Wordgard doesn't (`src/__tests__/accessibility.browser.test.tsx`); the README
  says how to write accessible React decorations. It found a Wordgard bug: `Wordgard.label`
  leaves the textbox without a name (`docs/wordgard-upstream-bugs.md`, 11). Left: a screen
  reader pass by hand, on the demo (NVDA with Chrome on Windows, VoiceOver with Safari): reading,
  navigating and selection announcements as in plain Wordgard, React decorations' chrome read as
  intended. Wordgard's drawn cursor keeps the DOM selection screen readers follow; untested by
  hand.

## Dropped (2026-11-01)

- **Consumers need `skipLibCheck`:** not ours. A consumer typechecked without it fails only on
  Wordgard's own typings (`editor.d.ts` names a `Decoration.Mark.Type` that doesn't exist); ours
  pass, `ReactWordgard` being internal. The README says so; Wordgard's bug is on the upstream list.
- **A standalone editor flushed from inside React** isn't detected: `ReactWordgard.create` is
  internal (Wordgard's copied tests, the benchmark), and the public `<WordgardEditor>` detects it.
- **React tooltips and panels:** an app positions its own popovers (Floating UI, Radix, Base UI)
  from `coordsAtPos`, as Stesura does; Wordgard's own tooltips and panels work as they are
 .
- **Composition and focus hooks:** react-prosemirror's `useIsComposingIn` and `useIsEditorStatic`
  aren't used by Stesura; focus is Wordgard's (`wg.hasFocus`, event listeners).
- **Several editors in one paginated layout:** Stesura's header, footer and note editors are
  created to edit and dropped after, their content kept as HTML; they don't take part in
  pagination.
- **Server-side rendering:** static HTML comes from Wordgard's own serializer, without React.

## Known differences from Wordgard

The DOM is equivalent in each case.

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
  render part of"); not reproduced.
- React widgets: the root must be an element; two same-type tag widgets on the
  same side of a sibling are told apart by order; one moving in or out of a wrapper remounts; with
  one in the document, every update walks the old tree to disconnect, as with native widgets.
- Refused updates: `plugin.update` runs twice for their transactions; one uncaught from
  a layout effect unmounts a React 18 root that has no error boundary.
- Wordgard has no `destroy()`, so an editor's React root is never unmounted.
- In development, StrictMode creates a second editor that is never connected.
- Wordgard bugs we mirror or work around: `docs/wordgard-upstream-bugs.md`.

## Internals to watch

- `src/wordgardInternals.ts` augments `wordgard/editor` with `Wordgard.DocTile`: harmless while our
  exported typings don't reference it.
- `ReactWordgard` swaps Wordgard's `DocTile.create` for the length of its base constructor, so
  React draws the first time; Wordgard looking up `DocTile` on the class would remove the swap
  (`docs/wordgard-upstream-bugs.md`, "Choosing the renderer before the first draw").
- Subclassing needs two `@ts-expect-error` for Wordgard's private constructor, and its internals
  are typed in one file; a renderer interface from Wordgard would remove both.
