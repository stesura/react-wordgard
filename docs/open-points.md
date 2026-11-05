# react-wordgard: open points (2026-11-01)

What's still open, in one place: before a release, performance, browsers and input, features,
the known differences from Wordgard, limits, and what to watch in Wordgard's internals. Remove a
point when it's done or dropped.

## Performance

- **Chunked child lists**, deferred. Per-node cells mean a keystroke renders only the edited
text's list. But React still clones the fibers of the edited node's siblings and of its
ancestors' siblings, and an Enter, a paste or deleting a paragraph renders the whole parent
list. Goal: those edits render one chunk, and a keystroke clones about n / chunk size fibers
instead of n.
  - Above a threshold (64–128 children to start), a plot's children render as chunk components,
  each a fragment of its children: no DOM is added, so the tile tree and Wordgard's DOM stay as
  they are.
  - A chunk's key comes from its first child's key when it's created. The partition is state per
  plot, kept in the plot's `Layout` and mapped by node key, not index, so a deletion at a
  chunk's start doesn't remount the chunk. Chunks are split or merged rarely, after inserts and
  deletes, moving as few children as possible.
  - Chunks never split a range or mark wrapper spanning blocks: chunking applies inside the
  wrapper's own list.
  - An insert or delete touches one chunk's list, a move across chunks two. Unchanged chunks keep
  the same views array, so their memo skips: `iterDeco` gives chunk slices per flat plot and
  reuses the unchanged ones.
  - Tests: insert, delete and move at chunk boundaries and across chunks; a range wrapper across
  a chunk boundary; a composition in a chunked list and at a boundary; React widgets at
  boundaries, tag widgets on a chunk's first and last child; undo of a deletion at a boundary;
  a refused update after chunking. Compare full `npm run bench` runs only.
- **The tile tree is rebuilt, not patched:** each update makes a new `ReactDocTile` and adds
every child tile to it (reused, without reading the DOM), 0.21 ms of a keystroke at 5,000
paragraphs. Patching means mutating the old tree in place (`state`, `decoSet`, the children's
`parent` and lengths): the riskiest change, for about that much.
- **A range wrapper spanning blocks has no cell:** typing in a block inside it renders its parent
list again. Correct, only slower.
- **A retry after a refused update can re-render a subtree in full:** `mapKeys` finds a plot
shared by the refused and the retried state already keyed, so `replaced` misses it, and its
layout from the refused pass is matched with offsets from that state. Never a stale view, only
lost reuse.
- **Updates that take the slow path:** two edits in one transaction re-walk every plot between
them. Correct, only slower.
- **Filtered timing runs read higher:** `VITE_BENCH_EDITORS=ReactWordgard` gives ReactWordgard
keystrokes 4–6 ms slower at 15,000 paragraphs than a full `npm run bench`, at any commit
(2026-11-01). Compare full runs only, or filtered runs only. The keystroke slowdown once noted
here was mostly this.
- **The timing benchmark's memory column** is unreliable after a ReactWordgard run (the next
editor shows negative values); `npm run bench:heap` is the one to read.
- `useEditorLayoutEffect`**:** one registered makes every flush run its read. A read returning
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
- **Wordgard's** `moveVertically` **test fails in WebKit** on plain Wordgard too; skipped there
(`test/skipInBrowser.ts`). Check it in Safari before reporting it (`docs/wordgard-upstream-bugs.md`, 8).
- **A widget next to an IME composition** may be redrawn rather than reused.

## Features not offered yet

- **Accessibility:** axe-core runs over editors with React shapes, marks and widgets, and finds
nothing plain Wordgard doesn't (`src/__tests__/accessibility.browser.test.tsx`); the README
says how to write accessible React decorations. Left: a screen
reader pass by hand, on the demo (NVDA with Chrome on Windows, VoiceOver with Safari): reading,
navigating and selection announcements as in plain Wordgard, React decorations' chrome read as
intended. Wordgard's drawn cursor keeps the DOM selection screen readers follow; untested by
hand.

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
