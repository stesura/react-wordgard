# react-wordgard: a React view for Wordgard (plan, 2026-10-30)

**Status:** R1 done; R2 mostly done; R3 done for what can be tested here; R4 in progress
(2026-10-31, see Progress): React renders every node and mark Wordgard's schemas define, and
every decoration, Wordgard's native widgets included, with stable keys and kept tiles, and keeps
the IME's text node through Wordgard's flush. React widgets and node views are next. The skeleton (a standalone copy of our react-prosemirror fork, Tiptap
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
- **Status:** done (2026-10-31). Met for text, marks, leaves (line breaks, images, rules), atoms,
  shapes with structure around the content hole (tables, figures) and inline plots, compared with
  Wordgard's own view. Not covered: inline plots with an atomic shape (they throw), and everything
  decorations draw (R4).

### R2: editing

Typing, deleting and Enter through Wordgard's input, with React re-rendering per transaction: keys
and re-renders from change sets, store-based state with stable contexts, view-description placement
by binary search.
- **Done when:** Wordgard's editing tests pass against the React view. Port the ones covering input,
  selection and coordinates first (the author's lesson: the view's test suite is the safety net).
- **Status:** mostly done (2026-10-31). Keys from change sets, kept tiles and a minimal render
  store are in; Wordgard's editing, input and selection tests already pass on the React view. Not
  done: view-description placement by binary search (not needed: tiles are built in one pass, not
  registered by components), and the store's subscriptions and selector hooks (deferred until a
  consumer exists, R4 or R5).

### R3: composition

Pause React-driven DOM and selection updates during IME composition, coordinated with Wordgard's
composition tiles, as react-prosemirror pauses its own.
- **Done when:** composition tests pass in Chrome, Safari and Firefox, including composing at a mark
  boundary and inside a node view.
- **Status:** done in Chromium, where all 15 of Wordgard's composition tests pass on the React view,
  mark boundaries included. Open: Safari and Firefox (the `browser` and `view` projects run
  Chromium only), a real IME (the tests emulate one, as Wordgard's do), and composing inside a node
  view (R4: there are none yet). Not done as planned: no pause, see Progress.

### R4: decorations, widgets and node views

Wordgard's point, range and tag decorations; widgets; React node views as components in the tree,
with a `getPos` read from tiles.
- **Done when:** a React node view shares the editor's contexts (no React root of its own), and
  widgets and decorations render and map through edits.
- **Status:** in progress (2026-10-31). Slices 1 to 4 of six done: decorations and Wordgard's
  native widgets render, redraw on their own and keep their DOM through edits. Next: React widgets
  (slice 5), React node views (slice 6).

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
- **2026-10-31, R1 nodes, done (R1 complete):** every node shape renders from React.
  - Layout: `iterDeco` now lays out any node (`nodeShape`, the shape with mark attributes, cached
    per tag), the `wg-buffer` images at an inline plot's edges, and `ensureHackNode`'s full rule
    (a trailing `<br>` also after a textblock ending in a line break; inline plots end in their
    buffer, so never). `uneditable` mirrors `buildNodeShape`'s rule: in editable content, the
    outermost element without a content hole gets `contenteditable="false"` (void elements
    excepted) and makes what it holds uneditable too.
  - React: `DefaultNodeView` draws any shape (elements, text, the hole), and the new
    `SeparatorHackView` (react-prosemirror's name) draws the buffers.
  - Tiles: `shapeTile` mirrors `buildNodeShape` over React's DOM: the node's tile (`Atom` when its
    shape has no hole), `NodeInner` tiles for structure (`Point` without a hole), `Widget.text`
    tiles for text in a shape, `AfterContent` after the hole, `PlotContent` on the element holding
    it, lengths as `sync()` computes them. Internals added: the `Leaf.Type` shape, `Widget.img`,
    `Widget.text`, and the `NodeInner`, `PointBefore`, `Atom`, `AfterContent` flags.
  - `checkRenderable` now refuses only namespaced (`svg:`, `math:`) shape elements and empty
    strings in shapes (React can't draw those). Inline plots with an atomic shape were refused at
    first, then mirrored with Wordgard's stray buffer after them; the Wordgard bugs found so far,
    and what to do once they're fixed, are in `docs/wordgard-upstream-bugs.md`.
  - Verified: seven documents added to `tile.browser.test.ts` (line breaks, images, a rule, lists,
    a table, figures, inline plots), with all the queries; line break and image edits in the edit
    sequence; concrete markup pinned. 104 tests. The test schema uses bare schema elements for
    images and tables, since their extensions add decorations.
  - `view` project: 124 pass (was 99), 61 skipped. Of the 41 under nodes, 25 pass; 15 moved to
    decorations (widgets, tag and point shapes, range wrappers and attributes) and 1 to a new
    `reuse` category ("preserves DOM nodes with changed wrappers marks": Wordgard keeps the
    `<img>` when its wrapper changes, React replaces it; R2 found keys can't fix it, now under
    `reparent`). The `nodes` category is gone.
  - Demo: `/wordgard.html` now has line breaks, images, a rule, a table and a captioned figure.
  - Audit fixes: the trailing-`<br>` rule skipped a plot whose content sits deeper in its shape
    (Wordgard's scan skips `NodeInner` structure), and React rendered some shape attributes unlike
    Wordgard's `setAttribute` (`draggable="false"` became `"true"`, `hidden=""` was dropped,
    `colspan`/`rowspan` warned); `src/helpers/props.ts` is now adapted rather than verbatim. Both
    covered by new documents (114 tile tests).
- **2026-10-31, R2 keys, store and kept tiles, done:** reviewed with Fable before starting (keys in
  the view, own store, improvements now rather than porting react-prosemirror's structure first).
  - Keys (`src/reactKeys.ts`, named after react-prosemirror's `reactKeys`; not a plugin): per
    parent plot, the keys of its children by index (`WeakMap<Plot, string[]>`), so a plot that
    keeps its identity keeps its keys with no work and rendering needs no positions. `update`
    maps them from the old doc through the change sections, as `reactKeys` maps positions through
    steps (`mapNodePos`: a copy of Wordgard's `mapPos` with assoc 1 and track "after", since
    Wordgard can't map over the bare sections `update` gets; see the requests in
    `docs/wordgard-upstream-bugs.md`), visiting only plots
    that changed identity: typing keeps a paragraph's key, a split keeps the first half's, a join
    the first paragraph's, a deleted node's key goes. Unlike `reactKeys`, replacing a node's
    first token by one token of the same type (a parameter change, e.g. a heading's level) keeps
    the key, and only plots and non-text leaves have mapped keys: text runs, wrappers and hack
    nodes are keyed after their previous sibling (`ChildNodeViews`), so a run keeps its text node
    when typing at its start (Wordgard's "reuses text nodes when changing their start"). Moves
    get new keys; keeping them (`reactKeys`' `overrides`) would need a transaction effect.
  - Render store (`src/contexts/RenderStoreContext.ts`, after the fork's): one object per content
    element, provided once, holding the keys; written inside the flush before React renders. No
    subscriptions yet, nothing re-renders without its props changing.
  - Kept tiles: a node that kept its identity was skipped by React (`DefaultNodeView`'s memo), and
    `restore` already undid browser edits in it, so `addChildTiles` reuses its old tile subtree
    instead of rebuilding it.
  - Audit (Fable, after the work): no blocking findings. A random comparison with Wordgard (500
    edits, then undo and redo all of them) matched on doc, DOM, tiles and queries, apart from
    attribute order (below). Fixed: a dead `Dirty` check on tile reuse (`restore`'s `sync()`
    clears it), and a unit test that didn't observe `mapKeys`.
  - Verified: `src/__tests__/reactKeys.test.ts` (9 unit tests: typing, insertion, deletion, split,
    join, parameter vs type change, nested plots, identity); three DOM and tile identity tests in
    `tile.browser.test.ts`, which fail with index keys or without tile reuse; the whole comparison
    suite and the `view` project unchanged.
  - Measured in Vitest's browser mode (React's development build, so slower than production; the
    throwaway harness isn't committed), median keystroke after load, Chromium, paragraphs with a
    mark: 2,500 paragraphs
    12 ms (23 ms before tile reuse; Wordgard 3 ms), 15,000 paragraphs 62 ms (123 ms before;
    Wordgard 18 ms). Load 0.4 s and 1.6 s (Wordgard 0.14 s and 0.64 s). What's left is linear in
    the doc's top-level children on each keystroke: React reconciling every one of them (memo
    hits, but each still compared), `iterDeco` relaying out the new doc's children, `mapKeys` and
    `addChildTiles` walking them. R6.
  - The pending "preserves DOM nodes with changed wrappers marks" test can't be fixed by keys: a
    wrapper changing element remounts what it holds in React, which never reparents. Moved to
    `reparent` in `test/view/pending.ts`.
- **2026-10-31, R3 composition, done in Chromium:** the browser's composed text node survives the
  flush, as in Wordgard's `ContentUpdate.composition`, rather than by pausing React.
  - How it differs from the plan and from react-prosemirror: the fork froze the composing block
    (`freezeFrom`: React kept rendering a cached element) and remounted it after the composition.
    Here React keeps rendering, and only the composed node is set apart: the layout
    (`iterDecoComposing`) splits the text around Wordgard's composition range into a `composition`
    view, placed in the wrappers the node sits in in the DOM (as Wordgard does, not by marks:
    composing at a mark boundary types into the `<strong>`'s node), or, when typing with marks and
    no text yet, the marks' wrappers around a buffer. React writes nothing to the node: when it's
    React's, React renders the value it last committed there under the same key (`childViewKeys`
    gives the composition that key and keeps it from its siblings), and when the browser made it,
    React renders nothing in its place. The tile is a `TextTile` flagged `Composition`, over the
    node.
  - `src/composition.ts`: finds the plot holding the composition and the plots down to it, which
    re-render through a `composition` prop (`DocNodeView`, `DefaultNodeView`, `ChildNodeViews`)
    and don't reuse their tiles. `ReactDocTile` records what React rendered into each text node,
    to know whose node is composed.
  - `restore` keeps the composed node as it is: the browser's own node gets a tile in the old tree
    first, since `sync()` removing it, even for a moment, moved the selection out of it. When a
    composition ends, React's node gets back the value React committed (React's next diff then
    writes the new one) and the browser's node is removed.
  - Verified: the 15 tests under `composition` in `test/view/pending.ts` pass and the group is
    gone (view project 139 passed, 46 skipped); four composition comparisons in
    `tile.browser.test.ts` (inside text, inside a mark, a new node at a block's end, an empty line)
    match Wordgard's DOM and tile tree at every step, and check the node and its parents are kept
    and the selection stays in it; they fail with composition handling switched off. After the
    composition, Wordgard keeps a stale `Composition` flag on the tile it reused, where React's
    view builds a new one; the comparison masks that flag there.
  - Audit (Fable) fixes: an edit before the wrapper holding the composition re-keyed the wrapper,
    so React remounted it and the composed node was lost; React's wrapper keys are now recorded
    too, and the wrappers around a composition keep theirs. A composed node inside an element
    the browser added (Chrome may wrap it in a `<span>` or `<font>`) was removed by `restore`;
    that element now takes the composition's place, with a tile as Wordgard makes for it.
    Wordgard drops a composition when `separateChange` fails (a replaced range across its edges),
    and so does the React view now. The comparisons also check the caret's offset (a write of
    the same value moves it to 0) and cover both bugs (10 steps, 6 cases).
  - Accepted: when a composition is cut short by an edit inside it, React's node gets React's
    committed value back and then the new one, two writes where Wordgard makes one; both inside
    the flush, selection restored by Wordgard.
- **2026-10-31, R4 slices 1–3 (decorations but widgets), done:** reviewed with Fable before
  starting (the approach compared with a render into a hidden copy and with public sources only).
  - `ReactDocTile` overrides `updateRanges` instead of `update`: Wordgard's own `update` diffs the
    decorations (`getDecoSet`, `findChangedRanges`) and hands over sections that include
    decoration changes, which fixes "decoration-only changes never render". The tile keeps its
    `decoSet` (passed `null` before).
  - `src/decorations/DecoIterator.ts`: Wordgard 0.6.2's `DecoIterator`, `SpanIterator`,
    `getDecoSet` and shape helpers, copied (MIT; Wordgard doesn't export them, and nothing keeps a
    reference to the iterator). Changes: `walker.enter` says whether to descend, and when it
    doesn't, the walk goes past the plot as a whole (spans are stretched past it, points inside it
    dropped) and emits its `after` widgets once past; the walker gets positions; walks can start
    before the last ended; sets come from the DecoSet. Its internal classes and facets come from
    `src/wordgardInternals.ts`: the facets from the providers the public `Decoration.Tag.*` and
    `Decoration.Mark.shape` return (`.facet`), the classes from instances the public factories
    make, as the tile classes are taken.
  - Layout (`iterDeco`): one plot's content at a time, walking the copied iterator without
    descending. Node views carry their `shape` (decorations included) and their laid-out
    `children`; a plot that kept its identity and whose content lies in kept sections keeps its
    previous layout (`layouts`, per root). `DefaultNodeView` skips a view drawing the same thing
    (`sameNodeView`: same node, same children, equal shape), and so does tile reuse. The layout
    holds the composition view (its key and React's text), so the `composition` props are gone.
    `iterDeco`'s own marks and shapes code went: the iterator gives shapes and wrappers, and the
    inline atom buffer (Wordgard bug 1) now comes from it rather than from a mirror.
  - Slice 3 came with the walker: tag attributes, wrappers and shapes, mark shape overrides,
    point attributes, shapes and wrappers, range attributes and wrappers all render. Six
    decorated documents added to `tile.browser.test.ts` (with all the queries), a decoration-only
    update, and pinned markup: 156 tests.
  - `view` project: of the 46 tests under decorations, 31 pass; the 15 left need widgets (the
    group is now `widgets`); "can reuse DOM structure when adding a shape wrapper" moved to
    `reparent` (a node given a wrapper is remounted). "Doesn't break spanning wrappers on widgets"
    passed before only because the widget was ignored; it's under `widgets` now. 549 passed, 17
    skipped overall.
  - Measured (same harness as R2, dev build): 2,500 paragraphs 12 ms per keystroke, as in R2;
    15,000 paragraphs about 85–95 ms (R2: 62 ms; Wordgard 15–22 ms this run). Per keystroke at
    15,000: React's reconciliation of the doc's children 52 ms, the layout 8 ms (new: the doc's
    children are walked again), tiles 8 ms, keys 4 ms. All linear in the doc's top-level children:
    R6 (walking only the changed sections of a re-laid plot, partitions for React).
  - Audit (Fable) fixes: Wordgard range sets whose second layer holds overlapping ranges can't
    be sought into (bug 5 in `docs/wordgard-upstream-bugs.md`), and React's per-plot walks seek,
    so a later plot lost a range wrapper on the first render; `DecoIterator` now splits range sets
    into layers that don't overlap. A plot object appearing twice shared one cached layout; a
    layout is now kept only where it was made (its start, mapped through the changes).
    `pastPlotAt` copied the rest of the children on each call (quadratic with many decorated
    plots); `nodeWrappers` returns a shared empty array again. Two regression tests (162 tile
    tests). The audit's own timing of the 15,000-paragraph keystroke was 51–68 ms, closer to R2's
    62 than the 85–95 measured here: the harness is noisy at this size.
  - Open: a plot whose type is atomic but whose decorated shape has a content hole would make its
    content walk find an atom parent and throw ("can't render part of"); Wordgard only meets this
    on an update starting inside such a plot. Not reproduced.
- **2026-10-31, R4 slice 4 (native widgets), done:** tag widgets, point widgets, nodes drawn as
  widgets and widgets inside shapes render as Wordgard draws them, with no wrapper element.
  - React draws nothing for a widget (`ChildNodeViews`, `DefaultNodeView`); `ReactDocTile`'s tile
    builder renders it (`widget.render(wg)`, `setUneditable` copied from Wordgard), or reuses its
    DOM, and puts it in place after React's commit. The child cursor skips widget DOM; when an
    element holds any, `placeWidgets` moves only widget DOM, and only where it's out of place
    (React's own nodes are in the right order among themselves). Widget DOM an element no longer
    holds is removed at the end of the build unless used elsewhere.
  - Reuse is positional, as Wordgard's: the old content tile's widgets are indexed, on first need,
    by their old position mapped through the update's sections (along kept and redrawn ranges, at
    both edges of a replaced one). Point widgets equal on the same side, not changed in the DOM,
    are kept whole; a node drawn as a widget is kept whole where React would skip it, else its
    DOM is reused and it's connected anew; widgets inside a shape are kept whole while the node's
    tag and shape are unchanged (Wordgard rebuilds a shape only when the node itself is redrawn).
    `restore` reports the widgets the DOM observer saw changed, since its `sync()` clears `Dirty`.
  - Connect and disconnect as Wordgard's `updateRanges` (`Reused.Full` / `Reused.DOM`). To keep
    documents without widgets on the old path, kept nodes are only recorded once a tree has held
    widgets (`ReactDocTile.widgets`). `ReactWordgard`'s constructor disconnects the tree Wordgard
    drew when it's already connected: an editor created with a `parent` connects its widgets twice.
  - Layout: widget views; spanning continuation skips them like buffers; the trailing `<br>` scan
    skips widgets out of the flow. Widget views don't count as the previous sibling for keys, so a
    widget coming or going doesn't remount the text after it.
  - Deviations from the handoff: widget keys don't chain (above). Reuse is by mapped position
    rather than by looking beside the cursor in the DOM: React appends new nodes after foreign
    ones and remounts wrappers whose element changes, which the first version lost widgets to.
  - Tests: the 15 pending `widgets` tests of Wordgard pass on ReactWordgard (`view`: 183 passed, 2
    skipped). `tile.browser.test.ts`: 7 widget documents in the compared table, an edit sequence
    comparing DOM, tile tree and which widget nodes survive each step with Wordgard, typing next
    to widgets, connect/disconnect logs, and bug 2 pinned for widgets: 195 tests. 603 passed and 2
    skipped overall.
  - Measured (median of 30 mid-document keystrokes, `basicSchema`, dev build, a harness of its
    own, not R2's): widget-free documents as before this slice (HEAD in a worktree, same harness):
    about 28 ms at 2,500 paragraphs and 150–170 ms at 15,000, Wordgard 2.5 and 15 ms. With a tag
    widget before each paragraph: 51 ms and 212 ms, Wordgard 8 and 39 ms.
  - Audit (Fable) fix: in a redrawn (`-2`) range Wordgard rebuilds the nodes starting there, so
    the widgets of their shapes (a node drawn as a widget, widgets inside a shape, an atom's) are
    disconnected and connected anew; React kept them whole. Now mirrored (`redrawn` in
    `src/tile.ts`), and the connect/disconnect test redraws through a range wrapper and a new tag
    widget. Left as they are: the double connect at construction and the reuse miss after a
    composition (both below), and the linear per-keystroke work on widget-heavy documents (R6).
  - Wordgard bug 7 found and mirrored: a non-editable text widget is left editable.
  - Open: a widget whose DOM is a `<br>` counts as content for the trailing `<br>` (Wordgard counts
    it as a break: its DOM doesn't exist at layout time). A widget next to an IME composition may
    be redrawn rather than reused (`keepComposing` puts the composed text in the old tree, so old
    positions after it are off). Widgets inside spanning wrappers only arise through Wordgard bug
    2, so the comparison sequences keep marks off widgets.
- **Open from R1's first slice:**
  - Composition: restoring the old tree undid the browser's composed text. Done in R3 (above),
    for Chromium; Safari, Firefox and real IMEs still to check.
  - Wordgard's constructor still draws the document once before `ReactDocTile.create` replaces it
    (its constructor calls the module's `DocTile.create`, not `Wordgard.DocTile`): double work at
    load, until the renderer interface.
  - Every update re-renders from the root and rebuilt the whole tile tree (O(document)). Since R2,
    unchanged plots keep their tiles and are skipped by React; what remains is linear in the doc's
    top-level children (see R2's measurements).
  - Decoration-only changes: done in R4 (`updateRanges`).
  - Decorations render since R4, widgets since its slice 4.
  - React writes attributes in prop order, Wordgard in sorted order: the DOM is equivalent but
    `innerHTML` differs once a shape has several attributes.
  - `flushSync` inside a React render or effect doesn't flush synchronously: an editor created
    from there, or a `coordsAtPos`/`domAtPos`/`nodeDOM` call from an effect with a pending update
    (`ensureFlushed`), would find React's DOM missing. Matters once a component owns the editor
    (R5).
  - Unrenderable content (now only namespaced shape elements and empty strings in shapes) throws
    from the flush and leaves the editor stuck on its last tree.
  - An empty text leaf with marks (Wordgard 0.6.2) is skipped with its wrappers, where Wordgard
    draws them around an empty text node; text on either side is then joined into one text node,
    so `resolve` and `posFromDOM` answers at that spot differ from Wordgard's.
  - Wordgard bugs (stray buffer after inline atoms, `enterSpanning` leaving moved points in the
    parent, `Attributes.compare` skipping attribute updates, empty text leaves): see
    `docs/wordgard-upstream-bugs.md`, with what to do once each is fixed. None reported yet.
  - Attribute order also differs after updates: React appends an added attribute (`style data-a`),
    Wordgard's fresh render sorts them, and Wordgard's own updates append too (an image given an
    attribute mark: `src data-comment` there, `data-comment src` in React). Comparisons by
    `innerHTML` after edits are order-fragile; none of the comparison documents hits it yet.
  - Shape attributes React still renders differently from `setAttribute` (none in Wordgard's
    schemas): `contenteditable=""` becomes `"true"`, `autofocus` and `checked` are handled as
    properties, `draggable` values other than `"true"`/`"false"` become `"true"`, and
    `hidden="until-found"` becomes `hidden=""`.
  - For R4: `iterDeco`'s spanning continuation skips point widgets too since slice 4.
  - Wordgard has no `destroy()`, so the React root is never unmounted; it lives as long as the
    content element.
