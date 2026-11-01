# react-wordgard: a React view for Wordgard (plan, 2026-10-30)

**Status:** R1 done; R2 mostly done; R3 done for what can be tested here; R4 done apart from its
open slice 6; R5 done (2026-10-31, see Progress): React renders every node and mark Wordgard's schemas
define, and every decoration, Wordgard's native widgets included, with stable keys and kept tiles,
keeps the IME's text node through Wordgard's flush, and draws React widgets in the editor's own
React tree. R5 done: the editor renders in the app's React tree, with hooks and a public API.
Next: R6 (performance). The skeleton
(a standalone copy of our react-prosemirror fork, Tiptap removed, `wordgard` installed, ProseMirror
still in place) is done. The public API follows Wordgard's, not react-prosemirror's (see "Follow
Wordgard's API").

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
does for ProseMirror: what Wordgard draws with code (widgets, as shapes, next to nodes or at
positions) can be React components in that tree, sharing its contexts, with no React root per
widget. Its API is Wordgard's: the bridge makes Wordgard's own concepts drawable by React, it isn't
a react-prosemirror compatibility layer. Stesura can then move to Wordgard; other teams can use it
too.

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
  and uses its internals, as react-prosemirror does with ProseMirror's. The risk is the same in
  kind; it's larger in degree because Wordgard is pre-1.0 and changes faster than
  `prosemirror-view` (which react-prosemirror pins exactly). We pin `wordgard` and re-copy its tests
  per tag. The lasting version is a renderer interface Marijn exposes; a working prototype is the
  case to make for it.
- **Positions count as in ProseMirror** (text by characters, a leaf as 1, a node with content as 2
  plus its content), so position logic ports as is.
- **Input is already `beforeinput`-driven** (`src/editor/input.ts`), and the DOM observer is small
  and mostly for composition: react-prosemirror had to build that layer itself.
- **The state moves at dispatch and the DOM in the flush.** That maps onto React's
  render-then-commit, a split react-prosemirror had to retrofit (`pureSetProps` /
  `runPendingEffects`).

## From ProseMirror to Wordgard

How what a ProseMirror (or react-prosemirror) editor does maps onto Wordgard, worked out on
2026-10-31 against Stesura's node views.

| ProseMirror | Wordgard |
|---|---|
| a node's `type` + `attrs` + `marks` | its **tag**: type, one parameter, marks (marks can sit on blocks: alignment is one) |
| `NodeSpec.toDOM` (a `DOMOutputSpec`) | the type's **shape**, an `Elt`: tag name, attributes, children (strings, `Elt`s, widgets, `0` the content hole); used for HTML output and parsing too |
| `nodeViews` prop (draw a type differently) | **tag decorations**: `Decoration.Tag.shape` (replace the drawing), `.wrapper`, `.widget` (`before`, `after`, `start`, `end`), `.attribute`; editor only |
| a node view's code (`dom`, `update`, `stopEvent`, `ignoreMutation`, `destroy`) | a **widget type**, `Widget.define({render, eq, propagateEvent, editable, connect, disconnect, inFlow})`: `eq` keeps the DOM, uneditable widgets' mutations are ignored |
| `Decoration.widget` | `Decoration.Point.widget` (a widget at a position) |
| `Decoration.node` (attributes, a wrapper) | `Decoration.Point.attributes` / `.wrapper` / `.shape` (on the node after a position) |
| `Decoration.inline` | `Decoration.Range.attribute` / `.wrapper` |
| a mark's `toDOM` | a mark's element or attribute shape; `Decoration.Mark.shape` overrides it |

- **A node view splits in three:** the decoration says which nodes, an `Elt` gives the structure
  and where the editable content goes (the hole), widgets carry what needs code. A widget never
  holds editable content: that's always an `Elt`'s hole.
- **Data a node view read from stores or React state** goes, for the editable element itself
  (attributes, styles), through decorations from the editor's state (a state field the producer
  updates by transaction; `decoratePlots` for values derived per plot); for non-editable parts, a
  (React) widget can subscribe on its own, since Wordgard ignores mutations inside it.
- **Worked example, Stesura's textblock node view** (`stesura/packages/pagination-react/src/node-views/line-numbering`):
  the element and schema attributes are the type's shape (a code block's `pre > code[0]` too);
  derived counters and spacing, attribute decorations from a decoration source; the pagination
  values on the `<p>` (`--pin-h`, `data-pin`, the break gap), point attribute decorations from a
  state field the pagination engine updates; the line-number gutter and break floats, React
  widgets (`Decoration.Tag.widget(Paragraph, "start", …)`, or inside the shape) that keep their own
  store subscriptions; `TextblockIdProvider`, the node's id in the widget's value. Cost to watch:
  every pagination update becomes a transaction through the flush (R6's linear work matters
  there).

## Design decisions

### Follow Wordgard's API

react-wordgard's public API is Wordgard's: the bridge adds only what React needs to draw
Wordgard's own concepts. No `nodeViews` prop (node views become tag decorations, with React drawing
their widgets), no keys plugin (keys come from the changes Wordgard gives the view), hooks designed
from Wordgard's state, plugins and listeners. react-prosemirror's names still guide internal naming
where the concept is the same (CLAUDE.md), not the API's shape.

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
- **Positions** come from tiles (a React widget's through a hook), instead of a `getPos` ref
  mutated during render. Wordgard hands a widget's `render` the editor, not a position.
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

## Testing

- **Documents:** test and benchmark documents put marks inside the paragraphs and, where there's an
  example, inline nodes (images, line breaks, links, inline plots like the tests' `Chip`), not
  plain text only. Plain-text cases are fine next to richer ones.
- **Browsers (done 2026-10-31):** Chromium, Firefox and WebKit through Playwright, in the
  `browser` and `view` projects; all three run on Windows (`npx playwright install firefox webkit`).
  Copied Wordgard tests that fail in one browser on plain Wordgard too are skipped there
  (`test/skipInBrowser.ts`): one so far, `moveVertically` in WebKit. WebKit is
  Safari's engine, not Safari: real Safari (autocapitalize, its IME handling) needs macOS, a Mac or
  a cloud service (BrowserStack, Sauce Labs). Real IMEs are tested by hand on each platform: the
  tests emulate composition events, as Wordgard's do.

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
  boundary and in a node whose shape has React widgets around its content.
- **Status:** done in Chromium, where all 15 of Wordgard's composition tests pass on the React view,
  mark boundaries included. Open: Firefox and Safari. Next step: add Firefox and WebKit to the
  `browser` and `view` projects (see "Testing"); real Safari and real IMEs need macOS and manual
  runs. Composing next to React
  widgets, in a shape with a React header, is compared with Wordgard since R4 slice 5. Not done
  as planned: no pause, see Progress.

### R4: decorations, widgets and React widgets

Wordgard's point, range and tag decorations; its native widgets; React widgets: real Wordgard
widget types drawn by React components in the editor's tree, usable wherever Wordgard takes a
widget (a tag or point shape, a tag or point widget, inside an `Elt` shape). Re-scoped on
2026-10-31 from "React node views as components with `getPos`" (see "Follow Wordgard's API").
- **Done when:** a React widget used as a node's shape and next to nodes shares the editor's
  contexts (no React root of its own), keeps its component instance while its value is `eq`, and
  maps through edits; decorations and native widgets render and map through edits.
- **Status:** done (2026-10-31), slices 1 to 5: decorations and Wordgard's native widgets
  render, redraw on their own and keep their DOM through edits; React widgets render wherever
  Wordgard takes a widget, keep their instance while `eq` and re-render in place when not. Slice
  6 stays an open question.
- **Slice 5, React widgets (done, see Progress):** a widget type defined like `Widget.define` (the same spec fields:
  `eq`, `connect`/`disconnect`, `propagateEvent`, `editable`, `inFlow`), with a component in place
  of `render`, and still a real `Widget.Type` (with a plain `render` fallback, so it works in
  plain Wordgard). Hooks for what `render` gets (the editor) and what actions need (the widget's
  position, from its tile). A value that isn't `eq` re-renders the component in place rather than
  remounting it, where React allows.
- **Slice 6, React shapes (open question, not planned):** a React component as a node's shape,
  owning the element around editable content. Only if a case needs React state to change that
  element itself, which decorations (attributes from the editor's state) and React widgets around
  the content can't cover; Stesura's textblock node view doesn't (see "From ProseMirror to
  Wordgard"). It would need an `EltTile` subclass whose `ignoreMutations` is true for the
  component's own commits outside the flush (React widgets don't: uneditable widgets already
  have their mutations ignored).

### R5: hooks

The public API, designed from Wordgard's (its state, `Wordgard.Plugin` with `update` and
`docUpdate`, transaction and update listeners, `scheduleDOMRead`): editor state and selectors,
effects, event callbacks, a React widget's position, selection state. react-prosemirror's hook
list is a checklist of needs, not the API: its names are kept only where the concept is the same
(stop-event is the widget spec's `propagateEvent`). Plus a layout hook running in the flush's read
and write phases, for pagination and anything else that measures. Where a react-prosemirror hook
meets a real need, offer the Wordgard equivalent.
- **README:** a "Migrating from react-prosemirror" section, written once the public API exists:
  how each react-prosemirror concept maps (node views to tag decorations and React widgets,
  `getPos` to `useWidgetPos`, hooks to their equivalents, `stopEvent` to `propagateEvent`), using
  the table in "From ProseMirror to Wordgard".
- **Done when:** each hook has tests, a measure-then-write hook lands its write on the same paint
  as the document update, and the README has the migration section.
- **Status:** done (2026-10-31), see Progress: `<WordgardEditor>` and `<WordgardDoc>` host the
  editor in the app's React tree; `useWordgard`, `useEditorState`, `useEditorStateSelector`,
  `useEditorEffect`, `useEditorEventCallback`, `useEditorLayoutEffect`, `useWidgetPos`; exports and the
  README's migration section. Not offered yet: event listeners (Wordgard's config covers them),
  node-selected, composition and focus state.

### R6: performance

Stable inline partitions for Wordgard's mark shapes, memoised children from change sets.
Starts only once the API (R5) is settled and stable (decided 2026-10-31).
- **Baseline first (done 2026-10-31):** `npm run bench:profile` runs Chromium's CPU profiler
  around mounting and around typing in each editor, and tables time by function (with callees and
  own), react-wordgard's functions apart, and by script file. Before R6, per keystroke at 15,000
  paragraphs with inline nodes (production, this machine, not idle): ReactWordgard 25.9 ms of work,
  Wordgard 11.3; our `updateRanges` 15.2 against Wordgard's own 2.7. In it: tile build 4.6,
  `checkRenderable` 3.4, layout 3.0, React's commit about 2.9, `mapKeys` 1.3, `childViewKeys` 0.4.
  Wordgard's own costs (reading the selection, about 5 ms; validating the new document, about 2)
  are in both. The user's idle machine gives the numbers to keep; this one's vary by tens of
  percent between runs.
- **Heap by class (done 2026-10-31):** `npm run bench:heap` diffs heap snapshots taken before and
  after mounting each editor. At 15,000 paragraphs ReactWordgard holds 72 MB of JS heap against
  Wordgard's 21 (marks; 135 against 36 with inline nodes). The extra is React's tree: about 70% is
  fibers (18 per paragraph with marks, 34 with inline nodes) and the plain objects of their props
  and hooks. The DOM is about the same size in every editor (79 MB with marks), so counting it,
  ReactWordgard holds about 1.5× Wordgard. Wordgard and ProseMirror hold the same; the 4× in the
  first memory column was a measuring error (Progress). react-prosemirror holds 126 fibers per
  paragraph with marks, about 9× our heap.
- **Per-keystroke cost linear in the doc's top-level children:** typing in one paragraph gives
  the doc a new identity, so React compares every top-level node view, and our layout, keys and
  tile build walk every child. react-prosemirror has the same structure (its `ChildNodeViews`
  re-renders the doc's whole child list and React compares every memoised node view); its cost per
  child against ours is what the baseline measures.
- **Candidates, chunking last:**
  - **Changed sections only (done 2026-10-31).** A re-laid plot whose last layout was flat (one
    node view per child, nothing else: the doc, block containers) keeps the views of its
    unchanged ends, the same node objects wholly outside every redrawn or replaced range
    (`unchangedEnds`, `src/changes.ts`), and walks decorations over the middle only. Node views
    carry their keys instead of their index, so a kept view stays the same object when the
    children after it shift. `mapKeys` copies the ends' keys and maps the middle;
    `checkRenderable` caches checked plots. In the tile build, a node view that's the same
    object as before takes its old tile without the cursor reading the DOM, but only in an
    element React kept (one that had a tile, in an update): under an element React drew anew
    (a heading's level changing its element), the same views have new DOM. For that to hold,
    `DefaultNodeView` keys the content it puts in a shape's hole, so React keeps it when a
    shape moves its hole within the same element (found by the audit: it crashed the build). Per keystroke at
    15,000 paragraphs with inline nodes, our `flush` went from 21.6 ms to 14.0: layout 3.0 to
    0.3, `checkRenderable` 3.4 to 0.5, `mapKeys` 1.3 to 0.4, `addChildTiles` 2.9 to 1.6. Still
    linear in the doc's children: React compares one element per child (about 3 ms), and the
    build and layout still loop over them, cheaply.
  - **Wordgard's first draw (done 2026-10-31), not as planned.** No empty state: the base
    constructor draws through `DocTile.create`, looked up on the class `Wordgard.DocTile`
    exposes, so for the length of `super()` that function is React's draw (put back on first
    call, for any editor React's render creates). The base constructor also isn't given the
    `parent`: putting the editor in the page connects it, which measured Wordgard's drawing, a
    forced layout React's drawing then needed again; the editor goes in the page once built. At
    15,000 paragraphs with inline nodes, the base constructor's own work went from about 540 ms
    (its draw, about 210, and that layout, about 330) to under 1 ms; ReactWordgard's
    constructor from 1,456 to 1,124 ms though our own draw ran 19% slower in that run (noise).
    Only a `ReactWordgard` takes the swap: an editor a plugin creates during the base
    constructor draws as before.
    Without that draw, Wordgard's own `baseTagShape` cache stays empty: the heap holds as many
    text widgets and node shapes as plain Wordgard's (at 15,000 paragraphs, 69 MB instead of 72
    with marks, 128 instead of 135 with inline nodes). The ask to Wordgard's author now only
    removes the swap (`docs/wordgard-upstream-asks.md`, 8).
  - Group the doc's children into memoised chunks, so React compares far fewer than one element
    per top-level child. Parked (decided 2026-10-31): not for v0. After the two above, a
    keystroke at 15,000 paragraphs takes 13–15 ms against plain Wordgard's 9–10; chunking React
    would save about 3 of that, and nothing at load or when formatting the whole document.
- **Done when:** measured on a 2,500-paragraph and a 15,000-paragraph document: keystroke, load, and
  a Ctrl+A formatting change, against react-prosemirror on the same documents.
- **Status:** partly done (2026-10-31): the baseline, changed sections only, and Wordgard's first
  draw; chunking parked. `npm run bench` then, at 15,000 paragraphs with inline nodes:
  keystroke 14.6 ms (Wordgard 9.6, react-prosemirror 98.6), load 965 ms (504), formatting the
  whole document 2,831 ms (1,124), on the user's machine, idle and on mains power (confirmed by
  the user, 2026-11-01).
- **Formatting the whole document (done 2026-10-31):** its profile (`npm run bench:profile` now
  profiles it too) showed the cost wasn't React's: such an update has a change section per run
  of text, and five helpers walked the sections from the start once per node, quadratic in the
  document (`unchangedEnds`, `mapNodePos`, `redrawn` and, less, `mapKept`, `isKept`,
  `pointMapper`). They're in `src/changes.ts` now, over an index of the sections built once per
  update and searched by bisection; a unit test checks them against walking the sections on
  random ones. At 15,000 paragraphs, per change: 1,637 ms to 693 with marks (Wordgard 488), 3,283
  to 1,973 with inline nodes (Wordgard 1,464). What's left is React drawing every paragraph
  again (about 240 ms with marks), the tile build (110) and the layout (40).
- **A node changing around unchanged content (done 2026-10-31):** setting a paragraph's alignment
  (a mark on its tag; the update redraws only its opening token) made a new paragraph whose
  content was laid out anew, so React re-rendered every text node and mark in it. A re-laid
  plot whose content draws the same as before, from the same place, now keeps its old views
  (`sameViews` in `iterDeco`), and `ChildNodeViews` is memoised on them: React redraws the
  paragraph's element only.
- **Stable inline partitions (done 2026-10-31):** typing re-rendered every run and mark of the
  paragraph. A re-laid plot now keeps, child by child, the old view of each child that draws the
  same, matched by its React key (`keepSame` in `iterDeco`); a wrapper whose content changed
  keeps its unchanged children. `MarkView` draws its children from its views, so it and
  `TextNodeView` are memoised: React re-renders the changed run only. Its cost, accepted
  (2026-11-01): 2–4 ms per keystroke at 15,000 paragraphs, none measurable at 2,500 (full runs,
  bisected over `ed5a7fd`, `c00fa12`, `0875b0b`, HEAD). The 26.7 ms once noted against the
  14.6 above compared a filtered run with a full one (open-points). Declined: running
  `keepSame` on a flat plot's changed middle only (about 1.9 ms of it). Keys are computed over
  the whole list, so this is only safe for flat plots; it would add a special case and change
  nothing in the output. Found with it, in R6's
  build shortcut: skipping kept nodes' DOM missed a removed native widget's DOM between them; an
  element that held widget DOM after the last build is now walked (`holdsWidgets`). "Same place"
  now maps a plot's place through its opening token (`samePlace`), kept or replaced by one (a
  parameter changed, as keys follow it), so an insertion at the start of a plot's content keeps
  the layout shortcuts. Audit (Fable): a plot object inserted right before itself took, in the
  same update, the layout just written for its copy, and the two shared tiles (a bug from
  before R6); layouts now record the pass that wrote them (`Layout.pass`), and only one from an
  earlier update is used.
- **`useEditorStateSelector` (fixed 2026-10-31, R5's API):** a selector building an object or
  an array made React loop (it needs the same result until the store changes). It's now React's
  own `useSyncExternalStoreWithSelector` (the `use-sync-external-store` package), which keeps the
  result per state, with an optional `isEqual`.
- **Open from the audit (performance only; the output matches Wordgard):**
  - `unchangedEnds` takes the first and last change in the whole document, so a transaction
    with two edits re-walks every plot between them, and a nested plot holding one of them is
    walked whole.
  - An insertion exactly at a plot's content start (a paragraph inserted at position 0) used no
    layout shortcut. Fixed with `samePlace` (above).

## Open questions

- **A renderer interface from Marijn:** what minimum would let the bridge stop using internals
  (constructing tiles, replacing the producer, the flush hooks)? Worth raising once R1 works.
  Concrete asks so far: the constructor looking up `DocTile` on `this.constructor` (R6 swaps the
  base class's `create` during `super()` instead); a public way to map a
  position over change sections (`docs/wordgard-upstream-bugs.md`, "Requests"). The list to send
  him, bugs included, is `docs/wordgard-upstream-asks.md`.
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
  inside `observer.ignore(() => runUpdate(...))`. A component's own `setState` committing later
  marks its tiles dirty and gets redrawn, unless it's inside an uneditable widget (Wordgard
  ignores mutations there): React widgets are fine, a React shape (R4's open slice 6) wouldn't be.
  Relevant to R1 (render inside the flush) and R4.
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
- **2026-10-31, R4 slice 5 (React widgets), done:** a React widget is a real Wordgard widget type
  whose component React draws in the editor's own tree.
  - API: `reactWidget(spec)` (`src/decorations/ReactWidgetType.ts`, react-prosemirror's file
    name) takes `Widget.define`'s spec plus `component`, calls `Widget.define` (its `render` is the
    fallback plain Wordgard draws) and registers the component in a `WeakMap` by type. The
    component gets `{value}` and, as in react-prosemirror, forwards its ref to its root element,
    which becomes the widget's DOM (a component that doesn't makes the flush throw). Hooks:
    `useWordgard()` (the editor, from the render store) and `useWidgetPos()` (a stable getter
    reading the tile's `posBefore`; throws once the widget is gone). Nothing is exported from
    `src/index.ts` yet.
  - Rendering: `WidgetView` (react-prosemirror's name), memoised on `widget.eq`, draws it for a
    point or tag widget (`ChildNodeViews`), a node drawn as a widget and a widget inside a shape
    (`DefaultNodeView`). The tile builder makes a `WidgetTile` over the root with the native
    widget's flags, sets it uneditable as Wordgard does, keeps the old tile whole where Wordgard
    would keep the widget, else disconnects it and connects the new one (over the same DOM when
    React re-rendered in place).
  - Instance identity comes from keys: a node drawn as a widget has its node's key; widgets in a
    shape their index in it; tag widgets are keyed after the sibling on their side (the next one
    for a positive side) and their type; React point widgets by mapped position, as Wordgard
    reuses native ones (`pointKeys` in `iterDeco`: an old one mapping there, equal and on the same
    side, else of the same type, else a fresh key). For that, the copied `DecoIterator` tells the
    walker which widgets come from point decorations, and `mapKeys` (now run before the layout)
    returns the plot each changed plot replaces. Widget-free lists cost what they did.
  - Bug fixed from slices 1–3: a kept layout's `start` was never updated, so after one edit every
    later one re-laid, re-rendered and rebuilt the tiles of every plot after the edit point.
    Layouts now record their offset in the parent's content, so those nested in a kept plot stay
    right too (the first fix covered top-level plots only; the audit found it). Measured (median of
    30 consecutive mid-document keystrokes, `basicSchema`, dev build, a throwaway harness): 15,000
    paragraphs 67 ms, was 277 ms (Wordgard 18 ms); with a native start widget per paragraph 65 ms,
    was 574 ms (Wordgard 23 ms); with a React one 70 ms; 2,500 paragraphs 8 ms, was 31 ms. Slice
    4's 150–170 ms came from another harness, which hit this less.
  - How it differs from the handoff: the value is the component's prop rather than a hook (it's
    what `render` gets; a re-render brings the new one); the position hook has a per-widget context
    (a handle that lasts as long as the component), since the render store is per editor;
    `contenteditable` is set by the bridge, as Wordgard's `setUneditable` does, not by a prop the
    component must spread; `render` stays required. One unchecked type guard
    (`widget is Widget<Param>` in `ReactWidgetType.ts`): a widget of a type was made by its `of`.
  - Tests (`tile.browser.test.ts`, 222): three React widget documents in the compared table (tag
    and point widgets, widget shapes, widgets inside shapes, mixed with native ones): DOM, tile
    tree and every query match plain Wordgard drawing the fallback. Also: an edit sequence matching
    Wordgard's DOM, tiles and which widget nodes survive; instance identity (kept while `eq`,
    re-rendered in place when the value changes); the hooks; a component's own update outside the
    flush (no `Dirty`, no redraw); connect/disconnect logs matching Wordgard; `propagateEvent`;
    the ref requirement; composing beside React widgets in a shape with a React header; an image
    drawn by a React component with hover state, kept through typing, that replaces its node on a
    double click and keeps its element and state. Sabotage: never keeping old React widget tiles,
    disabling position keys, or making the self-updating widget editable each fail a test.
  - Audit (Fable) fixes: layouts nested in a kept plot kept a stale start (above), which also
    remounted React point widgets there; `useWidgetPos` returned a stale position after removal.
    Documented, not fixed: a component may change anything inside its root but not swap the root
    (the parent's tile puts the old one back and React keeps the new, detached one, as with a
    native widget swapping its DOM); an `editable: true` React widget the user edits keeps the
    edit, where Wordgard redraws it from `render`.
  - Open: a React widget's root must be an element (no text root); two same-type tag widgets on
    the same side of the same sibling are told apart by order; a React widget moving in or out of
    a wrapper remounts (React can't reparent); with a React widget in the document every update
    walks the old tree to disconnect, as with native widgets. Slice 4's open items (a widget whose
    DOM is a `<br>`, reuse next to a composition) are still open.
- **2026-10-31, R5 (hooks and the public API), done:** the editor renders in the app's React tree,
  and the hooks follow react-prosemirror's names where the concept is the same.
  - Hosting: `<WordgardEditor>` (react-prosemirror's `ProseMirror`) creates the editor with
    `ReactWordgard.host(spec)`, the spec read once like `defaultState` since Wordgard's editor owns
    its state, and provides an `EditorContext`. `<WordgardDoc>` (`ProseMirrorDoc`) renders a portal
    into `contentDOM`, reading the element to draw from a store, then a `div` whose ref appends
    `wg.dom`, which connects the editor. `ReactDocTile.host` returns an empty tile; the portal's
    first layout effect calls `ReactDocTile.mount`, which builds the tiles over React's commit,
    before the editor connects, as Wordgard builds before connecting. Later updates commit
    through the portal store inside the flush (`flushSync`). `ReactWordgard.create` keeps its own
    root for the copied Wordgard tests. App contexts reach React widgets.
  - Store and hooks (`src/contexts/EditorContext.ts`, `src/hooks/`): one value per editor, never
    changing: the editor, a store of the state as of the last flush, published in the same React
    commit as the document, an effect queue and the measures. `useWordgard`, `useEditorState`,
    `useEditorStateSelector`, `useEditorEffect` (runs after the flush under way or pending, else
    in a microtask; never inside React's commit, so it may read layout and dispatch),
    `useEditorEventCallback`, `useEditorLayoutEffect({read, write})` (named `useEditorMeasure` until
    2026-11-01; reads in Wordgard's read phase,
    scheduled on every update, writes in the write phase inside `flushSync`, so React state they
    set lands on the same paint), and `useWidgetPos` from R4. `ReactWordgard.flush` overrides
    Wordgard's to run the effects after it.
  - A flush from inside a React render or commit (a layout read from a plain React effect, with a
    pending change) can't commit: `flushSync` defers there. The bridge detects it (the portal's
    layout effect reports each commit), hands React back the last committed element and state,
    and throws `RefusedUpdate` with a message pointing to `useEditorEffect` and
    `useEditorLayoutEffect`; `ReactWordgard.flush` then asks Wordgard for another frame, which
    catches up. This closes R1's open point on `flushSync` inside React for hosted editors.
  - Exports (`src/index.ts`): the two components, `reactWidget` and its types, the hooks.
    `ReactWordgard` and the tile code stay internal; the exported typings reach no Wordgard
    internals. README: a usage section and "Migrating from react-prosemirror". The Wordgard demo
    (`/wordgard.html`) now runs on `WordgardEditor` in StrictMode, with images as React widgets
    with hover state and a word count; driven in Chromium with real typing, no errors. Peer
    dependencies now ask for React 18 or 19 (the code needed 18 already).
  - Not offered yet: `useEditorEventListener` (Wordgard's `Wordgard.domEventHandler` in `config`
    covers it), node-selected state (`useIsNodeSelected`, `useSelectNode`), composition state
    (`useIsComposingIn`), focus state.
  - How it differs from the plan: the component owning the editor was an R1 open point rather
    than an R5 line; it's the base the hooks needed. No controlled `state` prop: Wordgard has no
    way to replace an editor's state without a transaction.
  - Tests (`src/__tests__/WordgardEditor.browser.test.tsx`, 15), on a document with marks, an
    image, a line break, a link, an inline plot, React and native widgets: DOM and tile tree
    matching plain Wordgard, through edits and in StrictMode; remounting `WordgardDoc`; widgets
    connected once, as in Wordgard; an app context reaching a widget and changing outside the
    flush (no redraw); each hook; the refused update recovering on its own. Sabotage: running
    effects at once, measure writes outside `flushSync`, no revert, the state published in its
    own commit, no retry, idle effects inside the commit, and the old state guard after the flush
    each fail a test. Shared test helpers moved to `src/testing/tiles.ts`.
  - Found on the way: Wordgard's `basicSchema` has no images, so the benchmark's "marks and inline
    nodes" document had none on the Wordgard side (committed that way in the benchmark's first
    commit). It now adds `image()` and checks each editor draws them.
  - Audit (Fable) fixes: a refused update left Wordgard with no frame requested, so the DOM stayed
    stale (and `ensureFlushed` quiet) until the next input; `useEditorEffect` ran inside React's
    commit when the editor was idle, so dispatching then reading layout was refused there; queued
    effects waited for `wg.state` to match the flushed state, which an update listener dispatching
    after each flush would prevent. Documented: StrictMode creates a second, never-connected editor
    in development; a measure's write is measured again only when it changes the content's size.
  - Open: a `useEditorLayoutEffect` registered makes every flush run the read and a write pass;
    `plugin.update` runs twice for a refused update's transactions (inherent to throwing inside
    Wordgard's flush); an uncaught refused update from a layout effect unmounts a React 18 root
    without an error boundary.
- **2026-10-31, heap breakdown (R6 baseline), done:** `bench/heap.bench.test.ts` takes heap
  snapshots through the DevTools protocol, in a browser command that parses them as they stream
  (`bench/heapSnapshot.ts`), and tables objects held by class per editor. The editors and documents
  moved to `bench/editors.ts`, shared with the timing benchmark. Two measuring errors found and
  fixed in both benchmarks, so the timing benchmark's earlier memory column is wrong: a suspended
  async test function kept the previous editor alive while the next was measured; and React DOM
  keeps the last event's target fiber (`return_targetInst`; an image's `load`) after its root
  unmounts, pinning the editor until its next event. Editors holding over 500 MB aren't
  snapshotted (react-prosemirror at 15,000 paragraphs): after snapshotting it at 700 MB, the page
  crashed later in the run.
- **2026-10-31, before R6: one WordgardDoc per editor, three browsers, done:**
  - A second `<WordgardDoc>` for one editor throws ("already rendered by another WordgardDoc"),
    whether added with the first or later: the editor's element can only be in one place, and two
    portals draw the document twice into one content element. Each portal claims the editor in
    `useInsertionEffect`, since every insertion effect runs before the first layout effect builds
    the tiles; StrictMode doesn't run them twice. react-prosemirror doesn't check, but its second
    `ProseMirrorDoc` would be broken too (the last one to commit takes the mount).
  - Firefox and WebKit run in the `browser` and `view` projects. Firefox passed as it was. In
    WebKit, our native-edit and composition tests failed because WebKit ignores `InputEvent`'s
    `targetRanges` option: patched in, as Wordgard's own tests do. Wordgard's `moveVertically`
    test fails in WebKit on plain Wordgard too; skipped there (`docs/wordgard-upstream-bugs.md`,
    8).
  - Left out, as decided: skipping a measure's write when `read` returns the same value (it
    needs an `eq` option to be useful; it can be added later without breaking anything).
- **Open from R1's first slice:**
  - Composition: restoring the old tree undid the browser's composed text. Done in R3 (above),
    for Chromium; Safari, Firefox and real IMEs still to check.
  - Wordgard's constructor still draws the document once before `ReactDocTile.create` replaces it
    (its constructor calls the module's `DocTile.create`, not `Wordgard.DocTile`): double work at
    load. Done in R6, by swapping that class's `create` during `super()`.
  - Every update re-renders from the root and rebuilt the whole tile tree (O(document)). Since R2,
    unchanged plots keep their tiles and are skipped by React; what remains is linear in the doc's
    top-level children (see R2's measurements).
  - Decoration-only changes: done in R4 (`updateRanges`).
  - Decorations render since R4, widgets since its slice 4.
  - React writes attributes in prop order, Wordgard in sorted order: the DOM is equivalent but
    `innerHTML` differs once a shape has several attributes.
  - `flushSync` inside a React render or effect doesn't flush synchronously: an editor created
    from there, or a `coordsAtPos`/`domAtPos`/`nodeDOM` call from an effect with a pending update
    (`ensureFlushed`), would find React's DOM missing. Since R5, a hosted editor refuses such an
    update with an error, hands React back what it committed and catches up on its next frame;
    an editor with its own root (`ReactWordgard.create`, the copied tests) still doesn't detect
    it.
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
