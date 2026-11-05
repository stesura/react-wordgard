# react-wordgard for react-prosemirror users (2026-11-05)

How react-wordgard differs from react-prosemirror, mostly in what makes it faster: where
react-prosemirror's cost grows with the document and what react-wordgard does instead, what comes
from Wordgard itself, and what each choice costs or gives up.

Left out: bulk edits in one transaction (an indent, a Replace All, a font size over the whole
document). Their gains come from Wordgard building one document per transaction where ProseMirror
builds one per step, which is the engine's model, not the React layer's work.

## The figures

`npm run bench` and `npm run bench:heap`, 2026-11-05: 1,500 paragraphs of about 100 words (about
300 A4 pages, a large real document), each with 2 to 5 marked runs, all directly under the root
(no lists or tables); no plugins, no node views or other decorations; headless Chromium, React
18.3.1 production build. Transactions are dispatched directly, so input handling isn't measured.

| | react-prosemirror 3.2.11 | ProseMirror | react-wordgard | Wordgard |
|---|---|---|---|---|
| To first interaction (ms) | 715 | 61.0 | 97.0 | 70.3 |
| Keystroke (ms) | 26.8 | 0.4 | 0.8 | 0.6 |
| Allocated per keystroke (KB) | 2,871 | 49.8 | 252 | 193 |
| Enter (ms) | 28.8 | 0.5 | 1.5 | 1.1 |
| Bold all (ms) | 446 | 85.0 | 153 | 93.7 |
| JS heap held after load (MB) | 103.4 | 4.0 | 13.4 | 2.9 |

The heap is from snapshots before and after mounting: the JS objects the loaded editor holds, the
document included. The DOM is about the same size in every editor (30 to 33 MB).

Over its plain editor: react-prosemirror costs 12× to first interaction and 67× per keystroke,
react-wordgard 1.4× and 1.3×. react-prosemirror's keystroke grows with the document: 0.3 ms at 50
paragraphs, 2.1 ms at 500, 26.8 ms at 1,500; react-wordgard's goes from 0.2 to 0.8 ms.

## Where react-prosemirror's cost grows, and what react-wordgard does instead

### Placing view descriptions

- **react-prosemirror:** every node, mark, text and widget view registers its view description
  from its layout effect and re-sorts its parent's whole child list, so mounting n siblings costs
  O(n²). A patch placing each one by a binary search instead took a 350-page document's load from
  9.1 s to 2.5 s.
- **react-wordgard:** no component registers anything. After React commits, one pass walks React's
  DOM alongside the layout and builds Wordgard's tiles (its view descriptions) in order. A node
  view that is the same object as before keeps its old tile without reading the DOM.

### React keys

- **react-prosemirror:** the `reactKeys` plugin keeps one table of every position, remapped and
  re-sorted through every step: about 300 ms a keystroke at 200,000 nodes.
- **react-wordgard:** no plugin. Each plot keeps an array of keys for its children, mapped through
  the change sections Wordgard hands its view (below): a plot no section touches keeps its keys
  for free, and in one that changed, the unchanged ends are copied and only the middle is walked.
  **Cost:** a node keeps its component through a move only within its parent (the same node object
  deleted and inserted in one transaction); moved to another parent, or dragged and dropped
  (Wordgard rebuilds a dropped slice from HTML), it remounts.

### Contexts, and one dispatch path instead of two

- **react-prosemirror:** a transaction gives the state and document contexts new values, so React
  scans every memoised node view for consumers. It supports two dispatch paths, synchronous
  (`flushSync`) and asynchronous (as React transitions), and keeps the view correct in both, which
  is what stops it from keeping its context values stable: that is only safe for synchronous
  dispatch. A patch doing so for synchronous dispatch cut a keystroke by about 30% at 2,500
  paragraphs.
- **react-wordgard:** one path. A dispatch never draws: Wordgard defers it to its flush, on the next
  animation frame (or at once when something needs layout), and React renders the document there,
  synchronously, in one `flushSync`. So the editor's context value never changes; hooks read a
  store the flush publishes in the same commit as the document, and never see a state the DOM
  doesn't show. Nothing has to be correct for a render racing a dispatch, and transitions,
  partial renders and the effect ordering they need aren't handled at all.
  **Cost:** the document's render can't be interrupted or spread over frames (no concurrent
  rendering for it); the app's own components outside the document still can.

### Inline partitions

- **react-prosemirror:** a textblock's children are partitioned into mark runs by copying them on
  every render, with new arrays, so editing one run re-renders the textblock's mark views.
- **react-wordgard:** the layout keeps each old view that draws the same (`keepSame`), and
  `ChildNodeViews` and `MarkView` are memoised on their list's shape, `TextNodeView` on its text:
  editing one run re-renders that run.

### Mounting

- **react-prosemirror:** a node view's first render reads `contentEditable` from a content ref
  that is still null, so mounting sets and then removes the attribute on every block; and the base
  `EditorView` constructor's attribute changes land on a document React has already rendered,
  restyling all of it.
- **react-wordgard:** Wordgard decides editability from its shapes, and React draws it once. The
  base constructor gets no `parent`, as connecting the editor makes Wordgard measure, and its
  `DocTile.create` is swapped for ours for the length of the constructor, so the first draw is
  React's, not a Wordgard draw thrown away.
  **Cost:** the swap relies on Wordgard's internals; it breaks if Wordgard looks `DocTile` up on
  the class (`docs/wordgard-upstream-bugs.md`, "Choosing the renderer before the first draw").

## What else react-wordgard does

### No hooks, effects or subscriptions per node

A react-prosemirror node view runs, per node: a store selector (`useEditorStateSelector`, whether
`reactKeys` freezes it), context reads, refs, a memo, a reducer and two layout effects that create
and update its view description, plus a view description object per node, mark and text run. In
react-wordgard, `DefaultNodeView` is a class with no hooks, `TextNodeView` a memoised text node,
and the tiles are built after the commit, outside React.

At 1,500 paragraphs react-prosemirror holds 99 MB above ProseMirror (3.1 million objects against
0.1 million), react-wordgard 10.5 MB above Wordgard (0.26 million against 0.1 million). That per-node bookkeeping is the likely cause, read from the code, not attributed in a
heap snapshot.

### Per-node cells

Each node view reads its view from a *cell*, the place tied to its position among its siblings.
An update hands changed views to their cells, which re-render only their component; a list whose
keys all hold the same view or cell keeps its shape, so its memoised parent skips. Typing in one of
1,500 paragraphs renders that paragraph and its ancestors, not the document's list.

- **Gain**, measured at 5,000 paragraphs when the change was made: keystroke 4.0 → 2.3 ms,
  allocated per keystroke 2.2 → 0.8 MB, Enter 6.5 → 5.8 ms.
- **Cost:** a class component calling `forceUpdate` from a mutable cell, outside React's
  props-down flow. The first version subscribed with `useSyncExternalStore`: a hook and two effects
  per node made load, Enter and Bold all slower and held 5 MB more, so it was dropped. The cells
  and class instances hold about 1 MB more at 5,000 paragraphs.
- **Not done:** React still clones the fibers of the changed node's siblings on the way down, and
  an Enter or a paste renders the whole parent list. Chunking long lists would cut both
  (`docs/open-points.md`, "Performance").

### Laying out only what changed

For each update, only the plots a change section touches are walked again. A plot outside every
redrawn range, in the same place, keeps its layout object; a flat plot (one node view per child,
like the document) keeps the views of its unchanged ends and walks the middle only. The tile build
keys only lists holding text or wrappers; a list of blocks needs none.

**Cost:** a refused update (React unable to commit) followed by a retry can lose reuse and
re-render a subtree in full. Never a stale view.

## What comes from Wordgard

- **Change sections.** Wordgard's view update receives the change as sections: kept, redrawn
  (marks or decorations changed, or DOM the browser edited) or replaced. Keys and layout come
  straight from them; nothing maps positions through steps, so there is no `reactKeys` plugin.
- **Decorations already diffed.** Wordgard diffs the decorations itself and reports the ranges
  whose decorations changed as redrawn sections, so a plot whose decorations didn't change isn't
  walked. react-prosemirror passes a decoration source to each node view, whose children call
  `forChild` on every render that reaches them.
- **One draw a frame.** Transactions dispatched between two flushes draw once: a burst of typing,
  a plugin's follow-up, a bulk command in chunks. react-prosemirror renders each synchronous
  dispatch. The benchmark flushes after every keystroke, so its per-keystroke figures don't
  include this.
- **The view tree is data, not a protocol.** Wordgard reads its tiles; it doesn't need each view
  to register itself during React's commit. That's what lets the build be one pass after React.
- **Mutations ignored inside the flush.** Wordgard's observer ignores DOM changes made inside its
  flush, so React's commit there isn't read as typing, and the observer stays on for the browser's
  own edits (Wordgard types through native DOM edits, for IMEs and virtual keyboards).
  react-prosemirror switches ProseMirror's observer off and handles typing itself. A React
  decoration re-rendering on its own commits outside the flush; react-wordgard filters those
  records in its own `MutationObserver`.
- **Read and write phases.** `useEditorLayoutEffect` reads in Wordgard's read phase and writes in
  its write phase, batched with Wordgard's own, on the same paint as the document. A write that
  resizes the content makes Wordgard update and measure again within the flush, so pagination
  settles in one frame. react-prosemirror's `useEditorEffect` also runs on the same paint (in
  React's commit), but each effect reads and writes on its own.

## Memory as node views get richer

Unmeasured: the benchmark has no node views. What a React decoration draws itself (a numbering
badge, a line-number gutter, table controls) is the app's React and costs about the same under
either library, slightly more here as chrome gets tiles: richer views bring the ratio between the
two closer to 1, not the gap in MB. Formatting and tables add marks and nodes, which pay the
per-node difference above: the gap in MB grows with them. A `bench:heap` case with React shapes
and marks would settle it.

## Other differences

- **The API is Wordgard's.** React components plug into Wordgard's decorations (`Tag.shape`,
  `Tag.wrapper`, `Tag.widget`, their `Point` forms, `Decoration.Mark.shape`) instead of
  `nodeViews`; their props keep react-prosemirror's names (`nodeProps`, `getPos`,
  `contentDOMRef`, `useStopEvent`, `useIgnoreMutation`, `useSelectNode`).
- **Only `react-dom`.** react-prosemirror depends on `react-reconciler`, its version matched to
  React's; react-wordgard doesn't.
- **Not offered:** static (server) rendering of the document through React, which
  react-prosemirror has (`useIsEditorStatic`): Wordgard serializes static HTML without React.
  `useIsComposingIn`, too.
- **Lifecycle:** Wordgard has no `destroy()`, so an editor's React root is never unmounted; in
  development, StrictMode creates a second editor that's never connected.

## Where react-prosemirror is ahead

- **Maturity.** react-prosemirror runs in production editors over ProseMirror, which is many years
  old; react-wordgard is at 0.1, over Wordgard 0.6.
- **The engine floor.** Plain ProseMirror types faster than plain Wordgard (0.4 against 0.6 ms a
  keystroke and 50 against 193 KB allocated at 1,500 paragraphs), because each Wordgard transaction costs in proportion to the
  document (`docs/wordgard-upstream-bugs.md`, 17). react-wordgard's keystroke sits on that floor.
- **Internals.** Both reach into their engine: react-prosemirror subclasses `EditorView` and builds
  its view descriptions; react-wordgard subclasses Wordgard through a private constructor, swaps
  its renderer and replaces its observer, all typed in `src/wordgardInternals.ts`. Wordgard is
  younger and changes faster, so that's more exposed here.
- **Concurrent rendering.** react-prosemirror can render the document as a React transition;
  react-wordgard renders it synchronously inside Wordgard's flush.
