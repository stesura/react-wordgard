# Virtualization in react-wordgard (feasibility, 2026-10-31)

**Status:** feasibility study, nothing implemented. Diagrams:
https://claude.ai/artifact/FRistPjqY9tiSsgEcozcPy (what is mounted, one flush, gap heights with a
page break).

**Question:** can react-wordgard render only the pages on screen, so that a long Stesura document
costs neither its full DOM node count nor a relayout of everything on each edit?

**Verdict:** yes, at page granularity, built on Stesura's pagination engine. It's possible in
ProseMirror too, and Wordgard doesn't make it dramatically faster at runtime. What Wordgard gives is
a better fit: the flush already runs the steps in the right order, which makes the subtle parts
(selection, timing, measuring) easier, at the cost of building a gap tile through internals. Do
it after the bridge is complete, and after it updates in O(changed) (below).

## Where the cost is today

- **Stesura already does the cheap version.** Every top-level text block is pinned to its measured
  height, and off-screen blocks skip layout and paint (`content-visibility: auto` with
  `contain-intrinsic-size`, `stesura/packages/pagination`). What remains is the DOM node count, the
  relayout it causes, and the work done per keystroke.
- **ProseMirror fork, per keystroke:** `reactKeys` (`../react-prosemirror/src/plugins/reactKeys.ts`)
  remaps every node in the document on any step that isn't an attribute or node-mark step, typing
  included: it copies and sorts all `posToKey` entries, maps each one, then walks the whole document
  with `doc.descendants`. Keys are stored by position, and typing shifts every position after the
  cursor. This is the "700k nodes per keystroke" seen when profiling, not React. Fixed in the fork
  (2026-10-31, uncommitted) with react-wordgard's scheme below: about 300ms to 0.3ms per keystroke
  at 200k nodes. Its remaining per-keystroke cost is O(siblings on the path): `ChildNodeViews` per
  ancestor, and the `children.sort(sortViewDescs)` each re-rendered node view runs in its layout
  effect (`useNodeViewDescription.ts`).

## Prerequisite: updates in O(changed)

react-wordgard's keys already avoid the full remap: keys are stored per parent plot by child index,
and `mapKeys` only visits plots that changed identity (`src/reactKeys.ts`). What still costs more
than the change, per update:

1. **`checkRenderable(state.doc)`** (`src/tile.ts`) walks every node. Only new nodes need checking.
2. **The root re-renders.** `ReactDocTile.render` passes the new doc to `DocNodeView`, so every
   ancestor on the path runs `iterDeco` and `childViewKeys` over all its children and React
   reconciles them. Memo stops the recursion, not the per-sibling work: O(siblings on the path).
3. **Tiles are rebuilt from the root.** `addChildTiles` loops over every child of each ancestor,
   and runs `iterDeco` a second time (`contentViews`).

The fix:

- **Subscribe by key.** A parent renders its list of keys. Each child reads its node from the
  `RenderStore` by key (`useSyncExternalStore`). In the flush, the store updates only the plots
  that changed identity, which `mapKeys` already knows. A keystroke then re-renders one block:
  O(depth). Store updates commit synchronously inside `flushSync`, so this stays within
  `runUpdate`.
- **Structural edits stay O(siblings).** Enter, paste or deleting across blocks changes a key
  list, so that parent reconciles all its (memoised) children. Chunking the list into components
  doesn't help: React can't move a child between parents, so an insert or delete that shifts a
  chunk boundary remounts the children that cross it, possibly under the selection. A flat keyed
  list is the only shape that never remounts.
- **Make the tile side incremental.** Rebuild tiles only along the changed path, reusing the kept
  index ranges of the old `children` arrays (from the change sections). Run `iterDeco` once per
  re-rendered plot.
- **Caveats.** Wrappers that span blocks make a plot's views depend on more than its own children:
  their parent must re-render when they change. Wordgard's own per-edit work stays O(siblings) (content arrays copied, `posBefore` summing
  lengths), but that's pointer and number work, far cheaper than React's per-fiber work.

## How virtualization would work

### What is mounted

- **Viewport.** The visible pages plus one page of margin on each side, found by binary search on
  the page layout.
- **Ensure ranges.** The blocks holding the selection's anchor and head, the composition, and the
  scroll target are always mounted, wherever they are.
- **Gaps.** Each run of unmounted siblings becomes one gap element with a fixed height. One
  placeholder per block is a simpler first version (1:1 with blocks, stable keys, no merging).
  Gaps sit at the level being virtualized: top-level blocks in a section's content, rows inside a
  long table (`<tr>` gaps), items in a long list. Their ancestors are always mounted.
- **Positions.** A gap is a `GapTile` whose length is the sum of the node sizes it covers. Wordgard
  computes positions from tile lengths, so `posBefore`, `getPos` and `posFromDOM` stay exact. Only
  `resolve(pos)` into a gap has no DOM, and the ensure ranges keep the editor from asking for one.

### In the flush, not in a layout effect

A layout effect would render, measure, set state and render again; that second commit lands
outside `runUpdate`, where the DOM observer sees it as a foreign edit; and `setDOMSelection` would
already have run against DOM missing the selection's block. In the flush:

1. `runUpdate` computes the viewport from the new state (ensure ranges included), React renders
   blocks and gaps, then `setDOMSelection` resolves into mounted DOM. No transaction is
   intercepted and no custom `setSelection` is needed: the viewport is derived from the state.
2. A writer mounts dirty blocks into the shadow container; a reader measures them; the engine
   re-lays out.
3. If anything moved, `invalidateLayout()` raises a flag that re-runs `runUpdate` with the new gaps
   and breaks, in the same frame (Wordgard's read/write loop, at most 6 passes).

Two limits of Wordgard's loop shape this: a reader can't trigger a re-render (only
`viewState.measure`'s flags re-run `runUpdate`), and writers run outside `observer.ignore`, so they
may touch the shadow container but never editor content. The flag would come from wrapping
`viewState.measure` in `ReactWordgard`, one more access through internals.

### Ownership

- **The view owns the mechanism:** viewport and ensure ranges, gap elements and `GapTile`, the
  viewport step in the flush, the drawn selection layer, `preventDefault` for edits crossing a gap,
  and a **viewport source** contract ("which ranges render, how tall is the gap from A to B").
- **The view also owns a measuring service:** render a block from the model, detached, into a
  shadow container; read it through a callback in the read phase; cache the result per block until
  the change sections say it changed. Dirty tracking comes for free from the change sections.
- **Pagination owns the layout:** what to extract from an element (line boxes, row heights), the
  engine as a function from cached measurements to a layout, break decorations, and a page-based
  viewport source. The dependency runs from pagination to the view's API.
- Without pagination, a default viewport source measures plain heights (CodeMirror 6 style), or
  virtualization stays off.

### Measuring blocks that aren't mounted

Stesura's shadow measurer clones the live node (`mount-nodes-in-shadow-dom.ts`,
`getEditorElementById` then `cloneNode`). A virtualized block has no live node, so measuring must
render from the model instead. That's natural here: a block's DOM is a pure function of its node
and decorations (Wordgard shapes through `DecoIterator`, mirrored by our components), so the shadow
pass can render the block's component into the container through a separate root. The ancestor
shells can still be cloned from live DOM, since ancestors stay mounted. Content that resolves
asynchronously still reports its resizes, and the shadow render must get the same decorations as
the live one.

The read phase doesn't replace the shadow container. Any accurate read after a change needs a
layout; the engine needs intrinsic heights (before breaks), and the live DOM carries the engine's
own output (break gaps, pins, clamps, zoom). The phases only give the right slot for it, with one
layout per frame.

### Heights and page breaks

- **Gap heights are distances in paginated space.** The engine lays the cached line boxes into
  pages, so it knows where a block splits and what the break adds without the block being mounted.
  A gap's height is `y(first block after the gap) − y(first block in the gap)`; with page-based
  virtualization, whole pages times the page pitch. Break padding only becomes DOM on mounted
  blocks.
- **Changes are corrected within the flush.** The view renders with the heights it has; the shadow
  pass and the engine run; the flag re-renders with the new gaps before paint.
- **Large changes (replace-all, width or font change).** Either measure everything in one long
  frame, or measure the visible pages and ensure ranges first and refine off-screen in later
  frames (provisional page count meanwhile). Where a block splits depends on every block above it,
  so the layout below unmeasured blocks is provisional until they are measured.
- **Anchor by content.** Before a re-layout, record the first visible block (mapped through the
  changes); after it, set `scrollTop` to that block's new top. Set `overflow-anchor: none` on the
  scroller.

### Selection

- **State selection needs no DOM.** Ctrl+A is a command (`selectAll`, Wordgard's keymap) and copy
  serializes from the state (`clipboard.ts`).
- **DOM selection.** The ensure ranges mount both ends; the DOM range spans the gaps in between.
  CodeMirror 5's contenteditable mode instead clamps the DOM selection to the rendered edge
  (`showPrimarySelection`); the native selection then disagrees with the real one and shift+arrow
  extends from the wrong place.
- **Highlight.** Native `::selection` paints nothing inside a gap, and Wordgard only draws the
  cursor. A drawn selection layer is needed, filling gap rectangles from the layout.
- **Mouse drag past the viewport** keeps working because the anchor's block stays mounted.
- **Typing over a gap.** Wordgard lets the browser apply `insertText` natively over a range
  (`input.ts`, the `allow` rule), so the browser would delete DOM including gap elements. Prevent
  it when the range crosses a gap. Composition can't be cancelled, so it needs its own handling.

### Fast scroll

The browser scrolls ahead of JavaScript, so a scrollbar drag or a hard flick shows blank space for
a frame or two. CodeMirror shows it too.

- Draw the page chrome over gaps so the user sees pages before text.
- Only render where scrolling stops: pages scrolled past between flushes are never mounted.
- Stay within the frame: render the visible pages first and the margin in later frames; trust
  cached heights instead of measuring freshly mounted blocks.
- Re-render only when the visible range leaves the rendered range; unmount lazily within a DOM
  budget.
- Defer `scrollTop` corrections until scrolling settles (writing it kills momentum in Safari).
- Keep prefix sums (or a Fenwick tree) of heights to find the block at a `scrollTop`.

### What is lost

- **Browser features** that read unmounted text: find in page, spellcheck, print. Stesura has its
  own for all three.
- **Screen readers in browse mode.** They read the accessibility tree, built from the DOM whatever
  the scroll position. Caret editing works; the headings list, quick navigation, read-all and
  counts only see what is mounted.

## ProseMirror versus Wordgard

- **Possible in ProseMirror?** Yes. A placeholder node view is a desc with the right `nodeSize`,
  react-prosemirror renders from state, and its `beforeInputPlugin` avoids most DOM parsing.
- **Easier in Wordgard:** the flush's order (viewport, render, DOM selection, measure loop); the
  read/write loop; viewport changes as "update" sections, the path decoration changes take; the
  drawn cursor; state-driven input; shapes as data, which makes the detached render natural.
- **Harder in Wordgard:** no gap primitive (a new tile kind through internals, against upstream
  changes, where ProseMirror's placeholder is a public node view); the bridge isn't finished; the
  native `insertText` rule needs overriding.

## Risks and confidence

Biggest risk: **native browser behavior around gaps.** Wordgard leaves typing, deletion, composition
and part of selection (horizontal caret movement, shift+arrow, drag-select, autoscroll, mobile
handles) to the browser, and browsers are inconsistent around non-editable blocks in a
`contenteditable`. Our browser tests only run Chromium.

Second: **exact gap heights.** A mounted block must render to its cached height, or content jumps
and breaks drift. Stesura has the infrastructure (shadow measurement, fidelity oracle, layout
check), but with virtualization a wrong height in an unmounted block only shows when it scrolls in.

Confidence:

- **High** (read in code): Wordgard's flush order and read/write loop, `setDOMSelection` after the
  tile update, positions from tile lengths, only the cursor drawn, `selectAll` as a command and
  copy from the state, native `insertText` over ranges, Stesura's measurer cloning live DOM,
  CodeMirror 5's clamped DOM selection and drawn selection, the per-keystroke costs above.
- **Medium** (plausible, not traced): a `GapTile` (the paths in `tile.ts`, `domobserver.ts`,
  `coords.ts` that would meet one: `nearest`, `findMutation`, `posAtCoords`, `instanceof` checks);
  wrapping `viewState.measure`; plugin-supplied decorations that change without a transaction.
- **Low:** the speed-up (nothing profiled here), browser behavior around gaps (no experiments),
  effort, CodeMirror 6 details (from memory).

## Next step: a spike

In the demo, without pagination: a static viewport, gap elements and a `GapTile`. Then try Ctrl+A,
shift+arrows across a gap, drag-select with autoscroll, and IME at a gap edge, in Chromium, Firefox
and Safari. That tests the biggest unknown before any design work.

## Open questions

- Can a Wordgard plugin supply decorations that change without a transaction? If not, page breaks
  lag by one frame (a dispatched effect).
- Which code paths does a `GapTile` meet, and can it be built without patching Wordgard?
- What else walked the document in the ProseMirror profile, besides `reactKeys`?
