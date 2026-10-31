# react-wordgard: a React view for Wordgard (plan, 2026-10-30)

**Status:** R1 in progress: React renders plots with a plain element shape, text, and element- and
attribute-shaped marks (2026-10-31, see Progress); other nodes are next. The skeleton (a standalone copy of our react-prosemirror fork, Tiptap
removed, `wordgard` installed, ProseMirror still in place) is done.

Related: `docs/wordgard-feasibility.md` (why Wordgard, and what a migration would mean),
`docs/partially-executed/react-prosemirror-fork-plan.md` (our fork),
`docs/partially-executed/text-style-steps-plan.md` (phase 3, one span per run).

Sources:
- our fork, `../react-prosemirror-original` (`origin` is `stesura/react-prosemirror`, at "release
  v6");
- Wordgard's view source, `src/editor/` (a local copy: `C:\Users\edoar\Downloads\wordgard-main\wordgard`);
- Wordgard's docs: [ProseMirror migration guide](https://wordgard.net/docs/prosemirror/),
  [guide](https://wordgard.net/docs/guide/), [reference](https://wordgard.net/docs/ref/), and the
  [footnote example](https://wordgard.net/examples/footnote/) (a nested editor, the pattern for our
  sub-editors);
- react-prosemirror's author's posts:
  - [Why I rebuilt ProseMirror view](https://smoores.dev/post/why_i_rebuilt_prosemirror_view/): the
    subclass approach, view descriptions kept with React doing the DOM, the ported test suite;
  - [Making React ProseMirror really, really fast](https://smoores.dev/post/making_react_prosemirror_really_really_fast/):
    memoisation, `getPos`, the keys plugin, cached children, why rendering stays synchronous;
  - [Transition low priority editor updates](https://smoores.dev/post/transition_low_priority_editor_updates/):
    deferred state for read-only side views only, and why it tears.

## Goal

A React view over Wordgard that renders the document from one React tree, as react-prosemirror
does for ProseMirror: node views are React components in that tree, sharing its contexts, with no
React root per node. Stesura can then move to Wordgard; other teams can use it too.

## How react-prosemirror works

- **`ReactEditorView` extends ProseMirror's own `EditorView`.** It keeps ProseMirror's input,
  selection and coordinates code, removes its mutation observer, and replaces only the rendered
  tree. There's no fork of ProseMirror: it reaches `EditorView`'s non-public members (`docView`,
  `domObserver`, `input`, `cursorWrapper`, `domSelection`) by redeclaring them, and carries its own
  copy of `viewdesc.ts`.
- **React builds ProseMirror's view descriptions** (the tree mapping document positions to DOM),
  through hooks (`useNodeViewDescription`, `useMarkViewDescription`, `ChildNodeViews.tsx`). Their DOM
  updates are no-ops; React does the DOM.
- **Typing goes through `beforeinput`** (`beforeInputPlugin.ts`), not DOM mutations, so React stays
  the DOM's owner.
- **Rendering is synchronous by default** (`flushSync` in `useEditor.ts`), because ProseMirror
  expects the DOM to match the state when dispatch returns. A transaction tagged `async` skips it.
- **During IME composition,** React-driven selection and DOM updates are paused entirely: in
  Safari, "even updating the selection to the same position it's already set to will end the
  current" composition.
- **The author's lessons:** "a very significant amount of ProseMirror's view functionality is baked
  deeply into the view descriptors"; selection management "could be its own library, full of
  browser-specific workarounds"; he ported ProseMirror's whole view test suite to catch what he'd
  missed.

## Wordgard's equivalent seam: the tile tree

- **Tiles** (`Tile`, `DocTile`, `EltTile`, `WidgetTile`, `TextTile`, `src/editor/tile.ts`) play the
  role of view descriptions.
- **Input, selection, coordinates and the DOM observer only query the tree through a narrow
  interface:** `docTile.posFromDOM`, `nearest`, `resolve(pos, side)`, `nodeTile(pos)` and
  `posAtCoords`, plus the `dom.wgTile` back-reference. That's the shape react-prosemirror plugs into.
- **The producer is in one place:** `DocTile.create` in the constructor and `docTile.update(state,
  changes, …)` in the private `runUpdate`, called by the flush. The bridge replaces those two calls
  with a tree React built.
- **Tiles aren't exported and `runUpdate` is private,** so the bridge subclasses Wordgard's editor
  and uses its internals, as react-prosemirror does with ProseMirror's. The lasting version is a
  renderer interface Marijn exposes; a working prototype is the case to make for it.
- **Positions count as in ProseMirror** (text by characters, a leaf as 1, a node with content as 2
  plus its content), so position logic ports as is.
- **Input is already `beforeinput`-driven** (`src/editor/input.ts`), and the DOM observer is small
  and mostly for composition: react-prosemirror had to build that layer itself.
- **The state moves at dispatch and the DOM in the flush.** That maps onto React's
  render-then-commit, a split react-prosemirror had to retrofit (`pureSetProps` /
  `runPendingEffects`).

## Design decisions

### Render inside Wordgard's flush

- **React renders inside the flush** (one per animation frame, before its paint), as its write
  phase. Wordgard's selection sync, measure and read/write phases then run against that DOM.
- **Pagination fits:** it's one pass (measure, compute in JavaScript, write), plus a one-time
  re-measure of rows whose exact-height mode flipped. The flush loops through write, measure and
  read phases up to 6 times in one frame, so text and pagination land on one paint.
- **The one-frame gap is by design:** the flush runs before the frame's paint, and Wordgard keeps a
  flushed state apart and refuses dispatch during the flush. Code reading the DOM right after a
  dispatch (a tooltip's `coordsAtPos`) goes through `scheduleDOMRead`.
- **No transitions.** They'd keep the page responsive during a large render but leave the DOM
  several frames behind Wordgard's state (clicks, selection and typing would read stale DOM). They
  can't coexist with composition, and they don't reduce the work. The author keeps the editor
  synchronous himself and uses deferred state only for read-only side views ("explicitly
  introducing torn state").
- **No deferred state for now.** It isn't in react-prosemirror; our debounced editor state
  (`editor-react/src/state/editor-state.ts`) covers side panels, using less CPU than
  `useDeferredValue` during typing bursts.

### State through a store, stable contexts

Context values stay stable (the editor instance); components read state through a store with
selectors. A changing context value makes React scan every memoised node view, in any editor. This
is the fork's `stableContexts` (about −30% per keystroke at 2,500 paragraphs) as the architecture,
not a flag: its synchronous-only limit came from upstream's transition path, which isn't used.

### Use change sets for keys and re-renders

- **Stable React keys:** one pass per transaction. Kept sections keep their keys, mark-only
  sections keep their structure apart from text splits, replaced sections get new keys. Today's
  `reactKeys.ts` maps every key through every step, with special cases.
- **What re-renders:** Wordgard's own renderer redraws replaced ranges, updates changed ones and
  reuses kept ones; the bridge reads the same sections. The author's recipe for speed (memoised node
  views, positions through a stable `getPos`, children cached when node and decorations are
  unchanged; a keystroke from 177 ms to 16 ms, "rendering 6 elements instead of 15,000") gets its
  "unchanged" test from kept sections.
- **`getPos`** reads the tile's position, instead of a ref mutated during render.
- **Decorations** map through one change set per transaction.

### Marks follow Wordgard's shapes

In ProseMirror every mark is its own wrapping element. In Wordgard, attribute-shaped marks merge
onto the run's single span, and element-shaped marks wrap, across several nodes unless a
lower-ranked mark forces separate wrapping. That rule set (`DecoIterator`,
`src/editor/decoration.ts`) is mirrored in what React renders. Phase 3 of the text-style plan ("One
span per run") asks our ProseMirror fork for the same rule; its React side (the run component
merging marks' attributes, the rank logic, the tests) carries over.

### Our fork's changes

| Fork change | For react-wordgard |
|---|---|
| Binary-search placement of view descriptions (`165b289`; load 9.1 s → 2.5 s at 350 pages) | Keep, as the default: tiles registered by components have the same ordering problem |
| Stable inline partitions (`3cc783d`) | Keep the principle, as the default; reimplement for Wordgard's mark shapes |
| `stableContexts` (`3f57a7d`, `966ce72`) | Keep as the architecture (above), not a flag |
| `reactKeys` reuse for attribute-only transactions (`f8de9b6`) | Drop the special case: change sets make it the default |
| `contentEditable` decided from the schema at first render (`55049b9`) | Keep the principle |
| Detaching React's children around the base constructor (`55049b9`) | Re-evaluate, probably drop: a workaround for ProseMirror's constructor |
| A side < 0 widget honouring its explicit marks (`59ed00e`) | Drop: ProseMirror decoration semantics |
| `@stesura` scope, CI, staged releases | Replace with the new library's own |

None of the kept changes needs a flag: each helps large documents and costs nothing on small ones.

## Scope of the port

react-prosemirror is about 9,100 lines.
- **Dropped:** Tiptap compatibility (about 1,400 lines, removed in the skeleton), the `beforeinput`
  plugin (508 lines, replaced by Wordgard's input), the synchronous path, probably
  `StaticEditorView`.
- **Kept from Wordgard, not rewritten:** its tiles, input, selection and composition handling. React
  owns the DOM.
- **Rewritten, about 5,000 lines:** `viewdesc.ts` (1,288) as a bridge to tiles; the rendering
  components (about 2,500); the hooks (about 1,100, mostly an API-level port); decorations (about
  600); `ReactEditorView` as a subclass of Wordgard's editor; the composition pause.

## Phases

### R0: skeleton

A standalone copy of our fork, its ties cut, renamed `react-wordgard`, Tiptap removed, `wordgard`
installed and imported by a smoke test, ProseMirror still in place; builds and tests pass.
(Handed off 2026-10-30.)

### R1: render a document from React

A Wordgard editor subclass whose tile tree React builds: the doc, textblocks, text, and
attribute- and element-shaped marks, following `DecoIterator`'s shapes. Wordgard's own renderer is
bypassed (`DocTile.create` and `runUpdate`'s tile update). React renders inside the flush.
- **Done when:** a static document renders identically to Wordgard's own view (DOM compared), and
  `posFromDOM`, `resolve`, `nodeTile` and `posAtCoords` give the same answers over both trees.
- **Status:** met for paragraphs, text and marks (and plots whose shape is one element with only
  the content hole: headings, blockquotes); leaves other than text, inline plots and structured
  shapes are the next slice.

### R2: editing

Typing, deleting and Enter through Wordgard's input, with React re-rendering per transaction: keys
and re-renders from change sets, store-based state with stable contexts, view-description placement
by binary search.
- **Done when:** Wordgard's editing tests pass against the React view. Port the ones covering input,
  selection and coordinates first (the author's lesson: the view's test suite is the safety net).

### R3: composition

Pause React-driven DOM and selection updates during IME composition, coordinated with Wordgard's
composition tiles, as react-prosemirror pauses its own.
- **Done when:** composition tests pass in Chrome, Safari and Firefox, including composing at a mark
  boundary and inside a node view.

### R4: decorations, widgets and node views

Wordgard's point, range and tag decorations; widgets; React node views as components in the tree,
with a `getPos` read from tiles.
- **Done when:** a React node view shares the editor's contexts (no React root of its own), and
  widgets and decorations render and map through edits.

### R5: hooks

The public API: editor state and selectors, editor effects, event callbacks, node position,
selection state, stop-event. Plus a layout hook running in the flush's read and write phases, for
pagination and anything else that measures.
- **Done when:** each hook has tests, and a measure-then-write hook lands its write on the same
  paint as the document update.

### R6: performance

Stable inline partitions for Wordgard's mark shapes, memoised children from change sets.
- **Done when:** measured on a 2,500-paragraph and a 15,000-paragraph document: keystroke, load, and
  a Ctrl+A formatting change, against react-prosemirror on the same documents.

## Open questions

- **A renderer interface from Marijn:** what minimum would let the bridge stop using internals
  (constructing tiles, replacing the producer, the flush hooks)? Worth raising once R1 works.
- **Several editors in one paginated layout** (headers, footers, notes): one flush per editor, or a
  way to coordinate their flushes so pagination measures them together.
- **Accessibility of Wordgard's drawn cursor and selection** (`src/editor/drawcursor.ts`): untested.
- **Server-side rendering:** whether to keep a static view (react-prosemirror's `StaticEditorView`)
  or render from Wordgard's HTML serializer.
- **Rules of React lint (done at R1's start, 2026-10-30):** the react-hooks plugin's full
  `recommended` preset (the React Compiler's checks) is on, except in `src/prosemirror/` and
  `src/helpers/refs.ts` (35 findings there, mostly refs written during render). Details in
  `eslint.config.js`.
- **The browser edits the DOM itself when typing (found 2026-10-30):** "Input is already
  `beforeinput`-driven" holds for computing the change, but Wordgard doesn't `preventDefault`
  `insertText`, inline deletions or composition; it lets the browser's edit through and records it
  (`addDOMChange` in `src/editor/input.ts`). React's text nodes will be mutated outside React. R2
  must decide how React agrees with those edits, or which input types to prevent. R1's answer,
  outside composition: before rendering, `ReactDocTile.update` runs Wordgard's own `sync()` on the
  previous tree, which puts the tiles the observer marked Dirty back to the DOM React committed;
  React's diff then applies cleanly. Wordgard's own typing tests that flush are pending (marks,
  composition); ours (`tile.browser.test.ts`, "follows the browser's own edit") emulate typing
  and deleting, including the browser removing React's `<br>`, and match Wordgard's result.
- **React commits outside the flush look like foreign edits:** Wordgard ignores mutations only
  inside `observer.ignore(() => runUpdate(...))`. A node view's own `setState` committing later
  marks its tiles dirty and gets redrawn. Relevant to R1 (render inside the flush) and R4.
- **Subclassing needs a typecast:** Wordgard's constructor is private and `docTile`, `runUpdate`
  and the tile classes aren't in its typings. Keep the cast in one file, or get the renderer
  interface above.

## Progress

- **2026-10-30, layout:** the ProseMirror view moved to `src/prosemirror/`; the Wordgard view is
  built at the root of `src/` and the old folder is deleted when it's replaced.
- **2026-10-30, test baseline (towards R2's safety net), done:** Wordgard 0.6.2's browser tests
  (`test/webtest-*.ts`, 184 tests) and their helpers are copied unchanged into `test/wordgard/` and
  pass against plain Wordgard in Vitest's browser mode (Chromium through Playwright). Unlike
  upstream's single mocha page, each file runs in its own page inside an iframe, so
  `test/wordgard-workspace.ts` adds the `#workspace` element and focuses the window; an audit
  confirmed the composition tests then run with real focus. Next: a `tempEditor` that mounts the
  React view, so the same files test it.
- **2026-10-30, takeover point (before R1), done:** `ReactWordgard extends Wordgard`
  (`src/ReactWordgard.ts`) swaps the tile tree Wordgard's constructor builds for a `ReactDocTile`
  (`src/tile.ts`), and every update returns one, so our code owns the root and sits in every
  flush. Wordgard still builds the tiles (`ReactDocTile.adopt` takes over its result); R1 replaces
  that with React. The `view` test project runs the same 184 copied tests with their editors and
  `Wordgard.DocTile` redirected to ours; sabotage checks showed 88 of them go through
  `ReactDocTile.create` and 26 through `update`, and `test/view/redirect.test.ts` fails if the
  redirect stops working. `runUpdate` needed no override, as hoped. How it differs from the plan's
  wording ("the bridge subclasses Wordgard's editor and uses its internals"): internals are typed in
  one file (`src/wordgardInternals.ts`, from the typings' own `Node.wgTile`, no casts); the
  private constructor needs two `@ts-expect-error` (on the `extends` line and `super`).
- **Open from the takeover:**
  - `src/wordgardInternals.ts` augments `wordgard/editor` with `Wordgard.DocTile`; once our
    public types reference it, consumers see that internal static too. Latent while
    `src/index.ts` exports nothing.
  - Our emitted `ReactWordgard.d.ts` extends a class with a private constructor, so consumers need
    `skipLibCheck`; Wordgard's own typings already require it.
  - Only `tempEditor`-based tests exercise the editor; mounting with `parent` (connect during
    `super()`) is covered by our smoke test only.
- **2026-10-30, R1 first slice, done:** React renders the document inside Wordgard's flush and
  `ReactDocTile` builds Wordgard's tiles over React's DOM; Wordgard's tiles are no longer adopted.
  - Supported: plots whose type's shape is one element holding only the content hole (paragraphs,
    headings, blockquotes) and unmarked text, plus the trailing `<br>` of empty textblocks.
    Anything else throws "react-wordgard can't render ..." rather than drawing it wrong.
  - Rendering: one React root per content element (`createRoot` on Wordgard's `wg-content`),
    `flushSync` in `ReactDocTile.create` and `update`, which run inside `runUpdate` and so inside
    the observer's `ignore`. Components follow react-prosemirror's names (`DocNodeView`,
    `DefaultNodeView`, `ChildNodeViews`, `TextNodeView`, `TrailingHackView`, in
    `src/components/`). Keys are indices; `DefaultNodeView` is memoised by node identity.
  - Tiles: after the commit, the doc is walked alongside React's DOM and real `EltTile`,
    `TextTile` and `WidgetTile` objects are built with the flags Wordgard's `ContentUpdate` and
    `sync()` set. Wordgard doesn't export those classes; `getTileClasses` takes them from a
    throwaway Wordgard instance, typed through `Object.getPrototypeOf`'s `any` (no `as`, but
    unchecked). Node shapes come from `Plot.Type.shape`, declared in `src/wordgardInternals.ts`.
  - Native edits: `update` first restores the DOM React committed (Wordgard's `sync()` on the old
    tree, plus attributes of Dirty elements, which `sync()` doesn't reset), then renders.
  - Verified by `src/__tests__/tile.browser.test.ts`: on six documents (paragraphs, empty ones,
    wrapped lines, bidi text, nested plots), the DOM, the whole tile tree (classes, flags,
    lengths, DOM), `resolve` and `nodeTile` at every position and side, `posFromDOM` at every DOM
    point and bias, `posAtCoords` on a grid and `coordsAtPos` at every position match Wordgard's
    own view, and stay matched through a sequence of edits and through emulated native edits
    (typing, deleting; two of them fail if the restore step is removed).
  - Wordgard 0.6.2 can leave empty text leaves in a document (fixed upstream after 0.6.2:
    `Leaf.text("")` now throws). React draws no text node for `""`, so they're drawn as nothing
    and a textblock holding only those gets the `<br>`, as Wordgard's later versions would.
  - With a `parent` in the page, Wordgard's DOM observer is live during the constructor, so
    `ReactDocTile.create` runs inside `observer.ignore` (else the first flush redraws everything).
  - `view` project: 87 of Wordgard's tests pass on the React view; the 98 that need what isn't
    rendered yet are listed in `test/view/pending.ts` and skipped by `test/view/skipPending.ts`
    (skipped, not `it.fails`: a failing editor keeps throwing from its next flush). By the first
    thing they hit: marks 29, other nodes 31 (images, line breaks, rules, tables, custom shapes),
    decorations 28 (R4), composition 10 (R3).
  - How it differs from the plan: R1 stops short of marks; the React root belongs to the editor
    (not a portal from the app's tree yet), because Wordgard's tests create editors imperatively.
- **2026-10-31, R1 marks, done:** element- and attribute-shaped marks render from React, on text
  and on plots.
  - Layout: `src/decorations/iterDeco.ts` (named after react-prosemirror's `iterDeco`) computes
    a plot's children the way Wordgard's `DecoIterator.walk` and `ContentUpdate.build` do: mark
    wrappers sorted spanning-first then by rank; attribute marks merged onto the plot's element
    (`addMarkAttributes`) or, for text, onto a span opened as an innermost spanning wrapper; a
    spanning wrapper continuing the previous sibling when it draws the same element
    (`enterSpanning`); adjacent text in one wrapper joined into one text node (`addText`); the
    trailing `<br>` when a textblock's last leaf, looking inside wrappers, isn't text
    (`ensureHackNode`). Cached per plot, shape per tag, wrapper per mark (all immutable).
  - React renders that layout (`ChildNodeViews`, `MarkView` in `src/components/marks/`), and
    `addChildTiles` builds tiles over it: wrapper tiles get `Wrapper` (and `Spanning`) flags and
    their children's length. The plan's per-mark partitioning (react-prosemirror's
    `InlinePartition`) isn't ported: Wordgard groups by drawn wrapper, not by mark.
  - Internals added to `src/wordgardInternals.ts`: `Mark.Type`'s `rank`, `element` and
    `attribute` shapes, and `Elt.addAttrs`.
  - Verified: six marked documents (nested element marks, marks of different ranks, links,
    attribute marks merging into one span, attribute plus element marks, alignment on blocks)
    added to `tile.browser.test.ts`, with the same checks as the first slice; marked text in the
    edit sequence; a native edit typing inside a mark. 69 tests.
  - `view` project: 99 pass (was 87), 86 skipped. Of the 29 tests listed under marks, 12 now
    pass; the other 17 first hit something else and moved: 10 to nodes (images, rules), 5 to
    composition (composing inside wrappers), 2 to decorations (point widgets, a mark shape
    override). The `marks` category is gone.
- **Open from R1's first slice:**
  - Composition: restoring the old tree undoes the browser's composed text, so the IME's text node
    doesn't survive the flush. R3 has to keep it (Wordgard's `Composition` tile) while React's own
    tree stays consistent.
  - Wordgard's constructor still draws the document once before `ReactDocTile.create` replaces it
    (its constructor calls the module's `DocTile.create`, not `Wordgard.DocTile`): double work at
    load, until the renderer interface.
  - Every update re-renders from the root and rebuilds the whole tile tree (O(document)); R2's
    change-set keys and kept tiles fix it. The layout is cached per plot since the marks slice, so
    unchanged plots aren't laid out again, but their tiles are still rebuilt.
  - Tag decorations (`Decoration.Tag.*`) and mark shape overrides (`Decoration.Mark.shape`) live
    in internal facets, so `checkRenderable` can't see them: a paragraph with a tag decoration, or
    a mark whose shape is overridden, renders with its default shape instead of throwing. Point
    and range decorations aren't seen either.
  - React writes attributes in prop order, Wordgard in sorted order: the DOM is equivalent but
    `innerHTML` differs once a shape has several attributes.
  - `flushSync` inside a React render or effect doesn't flush synchronously: an editor created
    from there, or a `coordsAtPos`/`domAtPos`/`nodeDOM` call from an effect with a pending update
    (`ensureFlushed`), would find React's DOM missing. Matters once a component owns the editor
    (R5).
  - Unrenderable content (pasting an image, a line break) throws from the flush and leaves the
    editor stuck on its last tree, until support lands.
  - An empty text leaf with marks (Wordgard 0.6.2) is skipped with its wrappers, where Wordgard
    draws them around an empty text node; text on either side is then joined into one text node,
    so `resolve` and `posFromDOM` answers at that spot differ from Wordgard's.
  - Wordgard 0.6.2 bug, found by the marks audit (still in Wordgard's main): when an update reuses
    a wrapper whose new attributes add a name sorting before an existing one (`data-a` or `class`
    next to `style`), `Attributes.compare` returns 0 early, so `matchingWrapper` skips
    `updateAttributes` and the attribute is missing from Wordgard's DOM. Wordgard's fresh render
    and React's output have it. Worth reporting upstream; a comparison test hitting it fails on
    Wordgard's side.
  - Attribute order also differs after updates: React appends an added attribute (`style data-a`),
    Wordgard's fresh render sorts them. Comparisons by `innerHTML` after edits are order-fragile.
  - For later slices: `iterDeco`'s spanning continuation looks at the last child only, where
    Wordgard's `enterSpanning` skips point widgets and moves them into the wrapper (R4); and its
    trailing-`<br>` rule doesn't descend into inline plots or treat a trailing line break as needing
    the `<br>`, as `ensureHackNode` does (the next slice).
  - Wordgard has no `destroy()`, so the React root is never unmounted; it lives as long as the
    content element.
