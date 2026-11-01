---
name: wordgard-internals
description: Map of Wordgard's editor internals (tile tree, flush, change sections, DecoIterator shapes, input/composition, DOM observer) and how react-wordgard's bridge plugs into them. Load before designing or writing any code that touches Wordgard's view (the Wordgard subclass, tiles, rendering marks/nodes/decorations, composition, getPos, the flush), or when porting react-prosemirror code to Wordgard.
---

# Wordgard internals for react-wordgard

Plan: `docs/react-wordgard-plan.md`. Wordgard source: `../wordgard` (remote
`code.haverbeke.berlin/wordgard/wordgard`). Notes below were taken at commit `08804c9`
(2026-10-30), 8 commits past the `0.6.2` tag, which is the version on npm and in
`package.json`. Check `git -C ../wordgard log 0.6.2..HEAD` if behaviour differs from npm.
All paths below are relative to `../wordgard/src/` unless stated.

## Packaging

- ESM only. Subpath exports `wordgard/<module>` → `dist/<module>.js`: `doc`, `state`, `editor`,
  `set`, `command`, `history`, `schema`, `collab`, `table`, `types`, `phrases`, `highlight-code`.
  `dist/view.d.ts` in the tarball is a stale leftover (old `EditorState` API): ignore it.
- `dist/editor.js` is one unminified bundle: `DocTile`, `EltTile`, `TextTile`, `WidgetTile`,
  `ContentUpdate` exist as plain module-local classes; TS `private` methods are ordinary methods.
- `@internal` members are stripped from `.d.ts`: `docTile`, `viewState`, `inputState`,
  `observer`, `flushedState`, `plugins`, `Wordgard.DocTile`. Redeclare them on the subclass
  (`declare docTile: …`), as `ReactEditorView` does for ProseMirror's `docView`/`domObserver`.
- **Reaching internals:**
  - `Wordgard.DocTile` (static, "@internal for testing", `editor/editor.ts`) is the real
    `DocTile` class. The constructor calls `DocTile.create(...)` by property lookup, so
    `Wordgard.DocTile.create` and `Wordgard.DocTile.prototype.update` can be patched/overridden.
  - The other tile classes aren't reachable by name; get them from instances
    (`docTile.children[i].constructor`) or port them.
  - `runUpdate` is called as `this.runUpdate(...)` from `flush`, so a subclass override takes
    effect at runtime (TS complains: cast the base class).
- **Constructor is `private`** (`static create(spec)`), so `class X extends Wordgard` doesn't
  type-check; extend a cast: `const Base = Wordgard as unknown as new (spec: Wordgard.Spec) => Wordgard`.
- Tests: `test/test-*.ts` run in node (mocha); `test/webtest-*.ts` run in a browser via
  `npm run testserver` or `npm run test-headless` (needs Chrome). Editor helper:
  `test/tempview.ts` (`tempEditor`); builders in `test/schema.ts`. Deps aren't installed in
  `../wordgard`; run `npm install` there first. They fire their own `beforeinput`, `input`
  and composition events, so they run as they are in Vitest's browser mode (this repo's
  `browser` test project).

## Document model (differs from ProseMirror)

- `Node = Plot | Leaf` (`doc/node.ts`). A **Plot** has content; a **Leaf** has none. Text is
  `Leaf.Text` with `param: string` (no newlines: line breaks are `LineBreak` leaves).
- A **Tag** = node type + param + marks. Leaves *are* tags; plots *have* one (`plot.tag`).
  Marks live on tags, not as separate wrappers in the model.
- Positions count like ProseMirror: a text char = 1, a leaf = 1, a plot = 2 + content. The doc
  plot's `length` excludes its own open/close tokens.
- State: `GardState` (facets, compartments, `state.facet(...)`, like CodeMirror 6),
  `Transaction` (`{changes, selection, effects, userEvent, scrollIntoView}`), `GardSelection`
  (`.Text`, `.Node`, cell selection in `table/`).
- Shapes (`doc/shape.ts`): `Elt` = tag name + `Attributes` (flat sorted `[name, value, …]`
  array) + children (strings, `Elt`s, widgets, or `0` = the content hole). A node type's
  `shape.create(param)` gives its `Elt`; no hole means it renders as an atom.
- `Mark.Type` has either an `element` shape (wraps) or an `attribute` shape (merged onto an
  element). `rank` (0–100, default 100): lower rank wraps outside higher. `spanning`: may cover
  several nodes; default true for element shapes, false for attribute shapes. Only spanning marks
  go on text.

## ChangeSet sections

`changes.sections` (`doc/change.ts`) is a flat array of `(lenA, ins)` pairs:
`ins == -1` kept, `ins == -2` marks changed (same structure), `ins >= 0` replaced by `ins`
positions of new content.

The tile update uses a derived `Changes` array (`editor/changes.ts`), same pairs but:
`-2` means "update" (redraw with DOM reuse) and covers mark changes, decoration changes
(`findChangedRanges` in `decoration.ts`) and DOM ranges the observer saw mutated (`addUpdated`);
zero-length updates are allowed; adjacent replaces/updates merge. **This is the "kept / changed /
replaced" signal the plan uses for React keys and memoisation.** If any global deco facet
changes (`tagShape`, `tagWidget`, `tagWrapper`, `tagAttribute`, `markShape`), every kept section
becomes an update.

## The flush (`editor/editor.ts`)

- `dispatch(tr)`: throws if called during the flush; applies appenders; `viewState.update`
  (state moves now); runs `transactionListener`s; `scheduleFlush()` (one `requestAnimationFrame`,
  only when `connected`).
- `connected` is set by the `<wordgard-editor>` custom element's `connectedCallback`. Nothing
  flushes until `wg.dom` is in the document.
- `flush()`: read the DOM selection → `observer.takeDirty()` → `observer.ignore(() =>
  runUpdate(update, domChanges))` → `viewState.flush()` (`flushedState = state`) → loop up to 6×
  {run `domWriters`, `viewState.measure`, run `domReaders` (flushing = Read)}, re-running
  `runUpdate` with flags if geometry changed → scroll target → `updateListener`s (dispatch
  allowed again here) → `checkDir`.
- `runUpdate`: composition info → plugins `update` (before the DOM) → attrs/styles →
  **`this.docTile = prevDocTile.update(state, changes, this, composition)`** → `setDOMSelection`
  if the tile tree changed or the selection was set → `observer.clear()` → plugins `docUpdate`.
- Mutations are only ignored inside `observer.ignore(...)`. **A React commit outside
  `runUpdate` (a node view's local `setState`, an effect) is seen by the MutationObserver as a
  foreign edit**: the tile gets `TileFlag.Dirty` and its range is redrawn next flush. React must
  commit inside the flush (`flushSync` within `runUpdate`), or the touched tiles must have
  `ignoreMutations` (non-editable widgets).
- Layout reads after dispatch: `ensureFlushed()` forces a flush in `domAtPos`, `coordsAtPos`,
  `nodeDOM`, `moveVertically`, …; it throws if called mid-flush with pending doc changes.
- `Wordgard.Plugin` (≈ CM `ViewPlugin`): `update(update)`, `docUpdate(wg)`, `connect`,
  `disconnect`, `remove`. `Wordgard.Update` has `changes` (composed), `startState`, `state`,
  `transactions`, `docChanged`, `selectionSet`, `geometryChanged`.

## The tile tree (`editor/tile.ts`)

Classes: `Tile` → `CompositeTile` → `DocTile`, `EltTile`; `WidgetTile`, `TextTile` (leaves).
Each tile sets `dom.wgTile = this` (declared on DOM `Node` in `dom.ts`).

- `length`; `boundary` (1 for a non-atom node tile, else 0); `posBefore`, `posAtStart`,
  `posAfter`, `posAtEnd` are **computed by walking parents** (`posBeforeChild` sums siblings), so
  they're O(depth × siblings): this is what a `getPos` should read.
- Flags (`TileFlag`): `NodeInner` (extra structure inside a node's shape), `PlotContent` (holds a
  plot's content), `Spanning`, `Wrapper` (mark/range-deco wrapper), `Point` (+ `PointBefore` /
  `PointAfter`: zero-length widgets and their side), `Composition`, `Synced` (DOM matches, children
  frozen), `Atom`, `HasContent`, `AfterContent`, `ContentNotLast`, `Dirty` (observer saw a
  mutation: don't reuse).
- `sync()` writes the DOM: `CompositeTile.syncChildren` inserts/removes child DOM to match the
  child list; `TextTile.sync` sets `nodeValue`. **This is the DOM writer the bridge replaces
  with React**: React's tree must produce the same structure and the tiles must point at React's
  DOM nodes.
- Queries (the seam input/selection/coords use): `DocTile.nearest(dom, requireNode)`,
  `owns`, `nodeTile(pos)`, `resolve(pos, side) → TilePos{tile, offset, pos}`,
  `posFromDOM(dom, offset, bias)`, `posBeforeDOM`, `coordsForElement`, and
  `tile.posAtCoords(state, x, y)`. Outside `tile.ts` the tree is touched only in `editor.ts`,
  `input.ts`, `dom.ts`, `coords.ts`, `drawcursor.ts`, `selection.ts`, `domobserver.ts`
  (`grep -n "docTile\|wgTile\|Tile.get" editor/*.ts`). Some of those also read tile classes and
  flags directly (`instanceof TextTile`, `TileFlag.PointSide`, `isPoint`, `ignoreEvent`,
  `ignoreMutations`, `markDirty`), so the bridge must build real tile objects, not look-alikes.
- `ContentUpdate` (the producer): walks old tiles (`TilePointer`) alongside the new content
  (`DecoIterator.walk`) per section: `keep` copies old tiles (reuse `Full`), `update` rebuilds and
  reuses DOM (`Reused.DOM`), `replace` builds fresh. Hack nodes: `ensureHackNode` adds a trailing
  `<br>` (`Widget.br`) to textblocks/inline plots that need one; `Widget.img` (`img.wg-buffer`)
  sits at the start/end of inline plots and stands in for the cursor wrapper during composition.
  These are Wordgard's TrailingHackView/SeparatorHackView.

## Shapes and decorations (`editor/decoration.ts`)

- `Widget` / `Widget.Type` (`define({render(value, wg), eq, connect, disconnect,
  propagateEvent, inFlow, editable})`). Non-editable by default (`contenteditable=false`).
- `Decoration.Shape = Widget | Elt<string | Widget>`: a node draws as one widget, or as an
  element tree whose children may be widgets and one content hole (`0`). A widget never holds
  the content: Wordgard has no node views; a node's interactive parts are widgets *beside* the
  hole, inside the shape.
- Per-type ("tag") decorations, as facets: `Decoration.Tag.shape(type, shape | (tag) => shape,
  {atom?})`, `.wrapper(type, elt with a hole, {target?})`, `.widget(type,
  "before"|"after"|"start"|"end", widget | (tag) => widget)`, `.attribute(type, attr, value |
  (tag) => value, {target?})`. Function forms are cached **by tag** and must be pure: they see
  the node's tag only (type, param, marks), not its position, parent or children. `atom` is
  needed when a shape function changes whether the plot draws as an atom. `Decoration.Mark.shape`
  overrides a mark's shape.
- `.derived` (`Tag.shape.derived`, `Tag.widget.derived`): `(state) => shape | (tag) => shape`.
  Wordgard tracks the state slots read (`GardState.Facet.derive`) in the outer function and
  redraws the type's nodes when they change; reads inside the returned tag function aren't
  tracked. Avoid depending on the document or selection: a changed shape costs work across a big
  document.
- `target` (on `Tag.wrapper`, `Tag.attribute`, `Point.attributes`, `Point.wrapper`): a CSS subset
  (tag name and classes, `img.x.y`) picking an element inside the node's shape. Without it,
  attributes go on the outer element (on a wrapper element when the node draws as a widget).
- Wrappers (`Tag.wrapper`, `Point.wrapper`): an `Elt<string | Widget>` with a hole, filled with
  the node's shape or the element `target` picks (`Elt.wrap` → `modifyBySelector`, then
  `wrapper.fill([elt])`). They wrap elements only: the content hole can't be targeted, so no
  wrapper puts an element between a node's element and its content (for `td > 0`, it lands
  outside the `td`). For that, the base shape needs the inner element, or a `Point.shape`
  replaces the shape. A wrapper may hold widgets (chrome around a node).
- Several attribute decorations on one element merge (`Attributes.merge`, `doc/shape.ts`): `class`
  values join with a space, `style` values with `;`, other attributes: the later wins.
- Point decorations (`PointSet`, `Decoration.Point.source`): `widget(w, {side, trackMode})`,
  `attributes(attrs, {target?})` (on the node after the point), `shape` (replace the next node's
  shape), `wrapper(elt, {target?})`. The node selection is a built-in point source adding class
  `wg-selected-node`.
- Range decorations (`RangeSet`, `Decoration.Range.source`): `wrapper(tag, {rank, spanning,
  attributes, scope, query, inclusive})`, `attribute`. Scope: `atom` (default), `inlineatom`,
  `all`.
- Point and range sources are functions of the state, **called on every update**: keep big sets
  in a state field and map them.
- **`decoratePlots({type, points?, ranges?, refresh?})`** (`editor/plotdeco.ts`): per-plot
  decorations, computed from the plot itself (its attributes and children), positions relative
  to its content start. Kept in a state field registered as a point/range source, so React draws
  them like any other. On a doc change, it recomputes the decorations of every matching plot the
  changed ranges touch, **the whole plot** (the outermost match): cheap for a table or a callout,
  linear in its size for a plot spanning most of the document (a section). `refresh(tr)` forces
  recomputing, for all plots or those a predicate picks. This is Wordgard's way to pass a
  parent's information to its descendants (attributes, shapes, widget values), or to shape a
  node from its children.
- **`DecoIterator.walk(from, inclusiveStart, to, walker)`** emits `enter(plot, shape, wrappers)`,
  `leave()`, `node(node, shape, wrappers, partial)`, `nodePart`, `widget(widget, side)`.
  `tagShape(tag, active)` = base shape (text → `Widget.editableText`), then mark attributes
  (`addMarkAttributes`), type attributes, type wrappers, range attributes. `nodeWrappers` = the
  element-shaped marks + range wrappers, sorted spanning-first, then by rank.
- **Mark rendering rule (what React must mirror):** attribute-shaped marks merge onto the node's
  element; for text, the text widget gets wrapped in a `<span>` carrying the merged attributes.
  In `ContentUpdate.build` that span is opened as a *spanning* wrapper, so adjacent text runs
  with equal attributes share one span (`enterSpanning`). Element-shaped marks become wrappers;
  spanning ones extend across siblings until a lower-ranked non-shared wrapper forces a split.

## Input, composition, DOM observer

- `editor/input.ts`, `InputState`. `beforeinput` computes the state change and dispatches it, but
  **lets the browser's own DOM edit through** for `insertText`, inline deletions and all
  composition input types (`allow` in the `beforeinput` handler). The following `input` event
  records the DOM change (`addDOMChange`) into `domDoc` / `domChanges` / `domMapping`, so DOM
  positions between dispatch and flush map correctly (`getDOMPos`, `posAtDOM`). The flush then
  reconciles: tiles over the mutated ranges are `Dirty` and get rebuilt/re-synced.
  **This contradicts "React owns the DOM"** (react-prosemirror's `beforeInputPlugin`
  `preventDefault`s typing): React's text nodes will be mutated by the browser. Options: let it
  happen and have React's next render agree (same text node, matching value), or
  `preventDefault` more types (Wordgard avoids this on purpose: virtual keyboards, Safari
  autocapitalize).
- Composition: `inputState.composing = {changes, target: Text | null}`; `getCompositionInfo` →
  `CompositionInfo {fromB, toB, text, target, wrapCursor}`. The tile update isolates that range
  (`separateChange`) and keeps the browser's text node and its wrapper elements
  (`ContentUpdate.composition`, a `TextTile` with `TileFlag.Composition`). `wrapCursor` (marks to
  type into) renders mark wrappers around an `img` buffer. `compositionend` → `clearComposition`
  marks the range dirty and flushes. `abortComposition` blurs to force-end it.
- `editor/domobserver.ts`, `DOMObserver`: a MutationObserver queue → `findMutation` →
  `tile.markDirty()` + a dirty range (`addDirtyRange`) → `takeDirty()` in the flush. Also tracks
  the DOM selection (`readSelectionRange`, `pollSelection`), resize, scroll, color scheme.
- Selection: `editor/selection.ts` (`setDOMSelection`, `readDOMSelection`, `moveVertically`,
  `moveToLineBoundary`); the cursor and selection are **drawn** (`editor/drawcursor.ts`,
  `CursorLayer`, always installed as `cursorPlugin`).

## Mapping from react-prosemirror

| react-prosemirror (this repo today) | Wordgard |
|---|---|
| `ReactEditorView extends EditorView` | subclass of `Wordgard` (cast the private constructor) |
| `docView: NodeViewDesc` + `viewdesc.ts` | `docTile: DocTile` + `tile.ts` |
| `ChildNodeViews.tsx` + `iterDeco.ts` | `DecoIterator.walk` |
| `useNodeViewDescription` / `useMarkViewDescription` | build `EltTile`/`TextTile`/`WidgetTile` from React refs |
| `beforeInputPlugin.ts` | `InputState` (already there; but see native DOM edits above) |
| `flushSync` in `useEditor` dispatch | React renders inside `flush` → `runUpdate` |
| `commitPendingEffects` | the rest of `runUpdate` + the flush's read/write loop |
| `reactKeys.ts` (maps keys through steps) | keys from change sections (kept/updated/replaced) |
| `TrailingHackView` / `SeparatorHackView` | `Widget.br` / `Widget.img` (`wg-buffer`) |
| `EditorView.someProp` / plugin props | facets (`state.facet(...)`), `Wordgard.Plugin` |
| PM `Decoration.inline/node/widget` | `Decoration.Range` / `Decoration.Point` / `Decoration.Tag.*` |
