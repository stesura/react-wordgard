# React decorations: plan (2026-11-01)

The library's purpose (CLAUDE.md, "Why this library exists"): every Wordgard decoration that
takes a shape, a wrapper or a widget can be a React component, and so can a mark's shape and a
tooltip. React widgets exist (`reactWidget`); this plan adds React shapes, wrappers and marks, the
hooks node views need, and React tooltips. It replaces the plan's R4 slice 6 ("React shapes, open
question") in `docs/react-wordgard-plan.md`.

Constraint (the user, 2026-11-01): Wordgard's API and taxonomy win, but the way a React decoration
is defined stays as close to react-prosemirror's as Wordgard allows, so Stesura's node views port
with as few changes as possible (`docs/stesura-node-views-audit.md` lists them).

## What react-prosemirror does, and what carries over

A react-prosemirror node view is a component receiving `nodeProps` (`node`, `getPos`,
`decorations`, `innerDecorations`, `contentDOMRef`), `children` (the content), the decorations'
HTML attributes as props, and a forwarded `ref` for its root. It stays safe while it re-renders on
its own for two reasons:

1. ProseMirror's DOM observer is switched off (`ReactEditorView.ts:131-134`); typing goes through
   `beforeinput` with `preventDefault` (`beforeInputPlugin.ts:300`). No React commit can be read
   as an edit.
2. A layout effect with no dependencies (`useNodeViewDescription.ts:156`) updates the view
   description after every commit of the node view, so ProseMirror's model follows React's DOM.

(1) doesn't carry over: Wordgard types through the browser's own DOM edits and reads them with
its observer (`docs/wordgard-upstream-*`, skill "Input, composition, DOM observer"). What carries
over, checked in Wordgard 0.6.2's `editor/domobserver.ts`:

- Records are only handled at Wordgard's next flush (`takeDirty` → `processRecords`), and
  `takeRecords()` gathers both its queue and the browser's pending records. So a layout effect,
  still inside React's commit, can take them, drop the ones a React decoration's chrome made, and
  give the rest back.
- `findMutation` skips any record whose nearest tile has `ignoreMutations` (widgets: when not
  editable). Our tile build already turns a shape's non-content children into `WidgetTile`s
  (`shapeTile` in `src/tile.ts`).

(2) carries over as rebuilding the decorated node's tiles in that layout effect.

## Design

### A React shape is an `Elt` Wordgard can read

Wordgard needs a shape it can reason about (whether the node is an atom, where its content goes,
`target` matching, attributes merged in). A React shape is therefore a real `Elt` with a content
hole, the fallback plain Wordgard draws, registered as React-drawn, as `reactWidget` registers a
real `Widget.Type`:

```ts
const CalloutShape = reactShape({ component: CalloutView }); // an Elt: <div data-wg-react="1">[0]
Decoration.Tag.shape(Callout, CalloutShape);
Decoration.Point.shape(CalloutShape); // per node, from a point source
```

Wordgard copies `Elt`s when it adds attributes or wraps them (`addAttrs`, `wrap`), so the
registry can't be keyed by object. It's keyed by a reserved attribute (`data-wg-react`) on an
`Elt` with a real element name: `Attributes.merge` keeps it through every copy, the fallback stays
a real element, and `target` selectors written against real element names still match
(`Elt.Selector` matches the name and classes). React never renders the attribute. The element
name must be the component's root element (`reactShape({component, element: "td"})`, `div` by
default; `span` for inline nodes, so plain Wordgard's fallback doesn't put a `div` in a `p`):
`target` selectors match the `Elt`, not React's DOM. The build warns in development when the
component's root differs. The lookup walks the shape's `Elt` tree, not just its top: a wrapper without `target`
makes the wrapper the node's outer element, with the React shape inside it.

Attributes Wordgard merges onto the React shape's own `Elt` (tag attributes, marks' attribute
shapes, point attributes, the selected-node class) become the component's props, as React props
(`className`, a `style` object). On a wrapped shape, untargeted attributes and `wg-selected-node`
land on the wrapper's element, as in plain Wordgard; documented.

React shapes are for plots only. A leaf's shape can't have a hole (Wordgard throws, "Leaf nodes
shapes shouldn't have a content hole"), and a holed shape makes an atomic plot non-atomic
(`Tag.shape` sets `isAtom`): a node without editable content is a React widget.

### The component's props, as react-prosemirror's

```ts
type ShapeViewComponentProps = AllHTMLAttributes<HTMLElement> & {
  nodeProps: {
    node: Node;              // Wordgard's node: its tag, param and marks
    getPos: () => number;    // as useWidgetPos
    contentDOMRef: Ref<HTMLElement>;
  };
  children: ReactNode;       // the content
  ref: Ref<any>;             // the root element: the node's DOM
};
```

The refs are typed `any`, as react-prosemirror's are, so `forwardRef<HTMLTableCellElement>` and
`useMergedDOMRefs(ref, contentDOMRef)` keep typing. Wordgard has no node views, so the props type
is named after the decoration (`ShapeViewComponentProps`, next to `WidgetViewComponentProps`;
decided by the user, 2026-11-01), but the fields keep react-prosemirror's names (`nodeProps`,
`contentDOMRef`, `children`, `ref`): a Stesura node view keeps its body; what changes is the props
type's name, what's inside `node` (Wordgard's model) and the registration (a tag decoration
instead of `nodeViews`). `decorations` and `innerDecorations` are ProseMirror's: left out until a
case needs a Wordgard equivalent.

The content goes where `contentDOMRef` points, else in the root (react-prosemirror's rule; Stesura's
`useStesuraNodeView` merges `contentDOMRef` into the root ref by default).

### The tile build over a React shape

After the commit, as for every node: the root element is the node's tile (`EltTile` with its tag);
the elements from the root down to the content element are inner structure (`NodeInner`); the
content element holds the content's tiles (`PlotContent`). Every other DOM node in the root, inside
or outside the content element, is chrome: a `WidgetTile` over a non-editable widget (a private
widget type), flags `NodeInner | Point`, plus `AfterContent` when it follows the content in DOM
order, as Wordgard's own `buildNodeShape` builds a shape's elements around its hole. So Wordgard's
selection, coordinates, `posFromDOM`, `childRange` and `ensureHackNode` treat chrome as they treat
widgets in a shape, and ignore mutations inside it natively. Chrome gets `contenteditable=false`
(`setUneditable`) unless the component sets `contentEditable` itself.

The walk is driven by the DOM, not by the shape: every child that is neither a view's DOM nor a
widget's DOM is chrome. Our `childCursor` throws on such nodes today ("React's DOM has extra
nodes"), so a React shape's elements get their own walk, which also places native widgets inside
them (`Tag.widget` start and end, `placeWidgets`).

The build reuses a node's old tile when its view is the same object (`sameNodeView`, `viewTiles`
in `src/tile.ts`). A React shape can re-render with different chrome while its view is the same
(from editor state, `useEditorState`, or a context, inside the flush), so that shortcut must not
hold for it: `ShapeView`'s layout effect marks its root after every commit (a `WeakSet` of
roots), inside the flush or not, and the build rebuilds marked nodes. Every rebuild, inside or
outside the flush, keeps `tileViews` and `viewTiles` in step, and replaces the tile in its parent
by splicing `children` and setting `parent` (a synced parent's `addChild` throws), as
`keepComposing` does.

### The component's own commits

Wrapped in our `ShapeView` (react-prosemirror's `ReactNodeView`), the component re-renders inside
Wordgard's flush (the build rebuilds it, above) or on its own: state, context, a store. Its own
commits are handled in two places:

1. **The records, in Wordgard's observer.** `ReactWordgard` replaces Wordgard's `MutationObserver`
   (`observer.observer`, before `connect` observes) with one whose callback filters records
   before queueing them. Inside a React shape's DOM it drops everything that isn't a content
   edit: records under chrome; `attributes` records on the root and structure elements (the
   component setting `aria-label` or a `style` from its state); `childList` records on the
   structure or content element whose added and removed nodes are all chrome. The rest queue as
   before. One mechanism covers the shape component's own commits and a child component
   committing straight into the structure. Unfiltered, those records would mark the node Dirty,
   our `restore` would reset the root to the fallback `Elt`'s attributes and `sync()` would undo
   React's chrome; so `restore` also skips React shapes' elements.
2. **The tiles, in a layout effect.** `ShapeView`'s layout effect, without dependencies, runs
   in the same commit; outside the flush (`editor.flushing` false) it rebuilds this node's tiles
   over React's DOM, keeping the content's tiles (the same views, the same DOM). A child
   component's commit that changes the structure without the shape re-rendering is rebuilt from
   the observer's callback instead, a microtask later (until then, a click's `posAtCoords` could
   read the old tiles; documented).

Timing, checked: React's DOM mutations and layout effects run in one task, and a
`MutationObserver` delivers in a microtask after it, so the filter sees the whole commit's
records. Between the commit and Wordgard's next flush, `readSelectionRange`, `beforeinput`'s
`posFromDOM` and `ensureFlushed` read tiles; with the node rebuilt and the content's DOM kept,
they read correct ones.

Limits, as in react-prosemirror: moving `{children}` under another element remounts the content
(the browser loses a selection or composition in it); `target` can't reach inside a component
(its attributes arrive as props).

### Wrappers and marks

- `reactWrapper({component})`: an `Elt` with a hole for `Tag.wrapper` and `Point.wrapper`;
  `children` is the wrapped shape. Same props (no `contentDOMRef`: the hole is where `children`
  goes), same tile build and commit handling, the wrapper's element being inner structure. A
  React wrapper around a React shape runs two layout effects, the inner first: the outer rebuild
  takes the inner's fresh tile.
- `reactMark({component})` for `Decoration.Mark.shape`: Wordgard's mark shapes are declarative
  (`Shape.Element`: an element name and attributes; `Decoration.Mark.shape` clones the mark type
  with it, and our `DecoIterator` builds the wrapper from `mark.type.element`), so the React mark
  is a `Shape.Element` carrying the reserved attribute, as for shapes. Always element-shaped and
  spanning (only spanning marks may sit on text): a React mark replacing an attribute-shaped mark
  becomes a wrapper. Props as react-prosemirror's `MarkViewComponentProps`: `markProps` (`mark`,
  `getPos`, `contentDOMRef`), `children`, `ref`, attributes. Drawn by `MarkView`; spanning marks
  keep spanning sibling runs (one component around them). A `contentDOMRef` below the mark's root
  is a nested `Wrapper` tile (`resolve` walks wrappers); chrome in a mark or wrapper is a `Point`
  widget tile without `NodeInner`. The wrapper branch of the build gets the same DOM-driven walk.

### Hooks React decorations use

react-prosemirror's, adapted (Stesura's counts in `docs/open-points.md`, "Hooks"):

- `useStopEvent(fn)`, in a React shape, wrapper or widget: `fn` returning true means Wordgard
  ignores the event, so it feeds `propagateEvent` inverted (`propagateEvent` defaults to true and
  receives only the event: the chrome's private widget type finds the handler from the event
  target's nearest React decoration). Wordgard checks it before its own handlers
  (`eventBelongsToEditor`), so a stopped event reaches no `domEventHandler` either, as with
  ProseMirror's `stopEvent`.
- `useIgnoreMutation(fn)`: lets a shape claim more records than its chrome (step 1 consults it).
- `useSelectNode`, `useIsNodeSelected`: from the node selection (Wordgard's point source and the
  `wg-selected-node` class).
- `useEditorEventListener(type, fn)`: one `Wordgard.domEventHandler` in the editor's config at
  creation, at the highest precedence, dispatching to the hooks registered: hook listeners run
  before keymaps (which are `domEventHandler`s too, through `KeyBinding`), as react-prosemirror's
  `handleDOMEvents` ran before plugins (decided by the user, 2026-11-01). Stesura's section break
  needs keydown first.
- `useNodePos`: react-prosemirror's name for what `useWidgetPos` does; one hook for shapes,
  wrappers, marks and widgets.
- `useMergedDOMRefs`: back in the public API (Stesura uses it), from the removed
  `src/helpers/refs.ts`.

### Tooltips

`reactTooltip({component})`, for Wordgard's `Tooltip` (`create(wg) → Tooltip.View`): the view's
DOM drawn by a component in the editor's tree, so it shares the app's contexts and draws in
Wordgard's flush, positioned by Wordgard. Its own state renders outside the flush like a widget's;
it's outside the content, so no mutation handling is needed. Last, after the decorations.

## Steps

1. **Spike (risk first):** a React shape in a test, with chrome toggled by its own state; with
   attributes on its root set from its state; with chrome changed by an editor-state re-render
   inside the flush; wrapped by a `Tag.wrapper`; and typing then a chrome toggle before the next
   frame's flush. Check that the filtered records leave Wordgard's next flush with nothing to
   redraw, that the rebuilt tiles give the same `posFromDOM`/`coordsAtPos` as a fresh build, and
   that typing in its content still reaches Wordgard. Stop and report if the records can't be
   told apart.
   **Done (2026-11-01), it holds.** `src/__tests__/reactShape.browser.test.tsx`, six cases, pass in
   Chromium, Firefox and WebKit: after each change Wordgard's next flush keeps the doc tile
   (nothing to redraw), and the tiles and DOM equal a fresh editor's. Each mechanism is needed:
   without the record sorting five cases fail, without the rebuild in the flush one, without the
   rebuild outside it three. The full suite passes (the known WebKit timeout aside).
   **Deviation:** no layout effect in `ShapeView`. A component re-rendering from its own state
   commits without its parent, so `ShapeView`'s effects don't run then. The records say which
   shapes changed instead: `sortRecords` (`src/decorations/ReactShapeType.ts`) collects the roots
   whose structure changed, and `src/tile.ts` rebuilds them from the observer's callback, before
   a flush (`ReactWordgard.flush`), or in the flush's build (`holdsChanged`). One mechanism for the
   shape's own commits, its child components' and those inside the flush.
   **Not covered yet:** an IME composition in the content while the chrome changes; chrome inside
   the content element (`childCursor` still throws on it); the content element changing (React
   remounting the content: the rebuild builds it from the views, untested); the root element
   changing.
2. **React shapes:** `reactShape`, `ShapeView`, the tile build, the commit handling, the flush
   fallback; `Tag.shape` and `Point.shape`.
   **Done (2026-11-01).** Exported (`reactShape`, `ReactShapeSpec`, `ShapeViewComponentProps`).
   `src/__tests__/reactShape.browser.test.tsx`, 13 cases, pass in the three browsers: the spike's,
   plus the node's position (`getPos`), a `Point.shape`, an IME composition in the content while
   the chrome changes (the composed node and the selection stay, the result matches a fresh
   build), content React remounts in another element from a context (Stesura's exact rows: a row
   tells its cells to clip their content), chrome beside a container's content in its content
   element (Stesura's slots), the warning for a root that isn't the shape's element, and a leaf
   refused. Deviations and what was learned:
   - **Chrome beside the content, in the content element:** supported for containers (plots
     holding blocks) only. There the content's DOM is all elements React drew for nodes, mark
     wrappers and widgets (`viewRoots`, `src/viewRoots.ts`, plus React shapes' and widgets'
     roots), so anything else is chrome, before or after the content (React draws `children` as
     one run); chrome between the content's nodes throws. A textblock's content is text, which
     can't be told from chrome text: there the content element must hold only the content
     (Wordgard's own table cells are textblocks; Stesura's hold paragraphs).
   - **Records on a content element:** in a container, the browser's typing never adds or removes
     its children, so those records are React's (dropped, the shape rebuilt). In a textblock they
     can be typing, unless the same batch shows React moving the shape's content (adding or
     removing an element that was a content element): a batch is one task's, and typing comes in
     tasks of its own. Then the batch's changes there are React's too (`sortRecords`).
   - **Element check:** a root that isn't the `Elt`'s element logs an error once
     (`console.error`, the only console call the lint allows), rather than throwing: a `td`/`th`
     choice from the tag is better made with two React shapes.
   - **Rebuild:** walks the reused content's tiles with the cursor (widget DOM placed, React's
     nodes checked in order), so the cursor's `skip` lost the widget lookup the spike added
     (open-points, the keystroke slowdown).
   **Not done:** the root element changing on its own (as for React widgets, the component must
   keep its root; documented); an IME composition while React remounts the content (the
   composition ends, as in react-prosemirror).
   **Audit (Fable, 2026-11-01)**, each finding checked against the code; all held and are fixed:
   1. Content React remounts lost its widgets: the old content's tiles weren't disconnected, and
      native widget DOM left in the old element (React doesn't remove it) was then walked as
      chrome, the widget drawn twice. The build now takes that DOM out first and reuses the old
      content's widgets through the pool (the rebuild maps positions as all kept), and the rebuild
      disconnects what it didn't reuse.
   2. A replaced tile kept its `parent`, so a later record could still reach it through Wordgard's
      `owns` (a crash in `posBefore`): the rebuild detaches it.
   3. Records Wordgard takes outside the flush (`focus`, through `clear`) collected changed shapes
      without rebuilding them: taking records now rebuilds (outside the flush). The build's and the
      rebuild's own DOM work (widget DOM placed, strays removed) was read back as changes: both
      discard those records.
   4. Limit, documented in `sortRecords`: typing in an empty textblock in the same task as a commit
      moving its content would be taken for React's.
   5. Tests added: the observer's callback path (no flush between the commit and the check),
      widgets in content React remounts (a native and a React one, drawn and connected once), a
      deletion, nested React shapes. The comparison is with a fresh ReactWordgard, not plain
      Wordgard, which draws the fallback `Elt` (different DOM by design).
   6. The `inline` flag set from a layout effect is gone: the record sorting reads the node's kind
      from its tile (`holdsText`), one predicate with the build's `isContainer`.
   After the fixes: 16 cases × 3 browsers pass; full suite 1910 passed, the known WebKit timeout
   aside; `npm run check` and `npm run build` clean.
3. **React wrappers:** `reactWrapper`; `Tag.wrapper` and `Point.wrapper`.
   **Done (2026-11-01).** Exported (`reactWrapper`, `ReactWrapperSpec`,
   `WrapperViewComponentProps`). `src/decorations/ReactWrapperType.ts`, `src/components/WrapperView.tsx`;
   the handles and record sorting are shared with React shapes (`ReactShapeType.ts`), and so is the
   tile build (`reactShapeTile`). 16 new cases in `src/__tests__/reactShape.browser.test.tsx`, in
   the three browsers: drawing and `getPos`, chrome and attributes from its own state, typing with
   the chrome changing before the flush, a script's mutation in what it wraps (Wordgard redraws
   it), what it wraps remounted by React, a `target` inside a plain shape, a React shape wrapped
   (either changing, and both in one task), a `Point.wrapper`, an atom a React widget draws, a
   native widget refused, the element warning, and from the audit: widgets in what React
   remounts, nesting (React in React, plain around React), shapes and wrappers swapped, a
   component not drawing its children. Deviations and what was learned:
   - **What's wrapped is found by a ref**, not from the shape: React draws it with a ref on its
     root (`outerRef`, through `ShapeView` and `WidgetView`), the wrapper's `wrappedRef`. A plain
     element can't be told from chrome otherwise.
   - **One rebuild per changed root, from the node's tile down**, not "the inner first, then the
     outer taking its fresh tile": `rebuildShape` already rebuilds the whole node from its view,
     keeping the content's tiles, so either order gives the same tiles.
   - **The record sorting stops at the wrapped element.** Without it, a mutation the wrapped node's
     own DOM gets (a script, a spellchecker) was dropped and never redrawn (tested).
   - **Limits:** no React wrapper around a node a native widget draws (its DOM is placed after the
     commit, and the component's `children` can't be located: throws, pointing at a React
     widget), nor around text (throws). Around an atom, the root is made uneditable at build, as
     Wordgard does, whether or not the component passes `contentEditable` on.
   **Audit (Fable, 2026-11-01)**, each finding checked against the code:
   1. **Accepted, fixed.** The rebuild outside the flush disconnected only the old content's
      widgets, never the native widgets beside the hole in a wrapped shape React remounted (two
      connections). Tracing it found worse: React doesn't always remount what's wrapped. Moving
      `{children}` into a `div` when the wrapped element is a `div` makes React keep the old
      element as the new structure, with the old widget DOM in it, which the build then read as
      chrome (the widget drawn twice). The build now takes the old wrapped tree's widget DOM out
      of the page, unless it's still in what's wrapped (`removeWidgetDOM`), and the rebuild
      disconnects the whole old node tile except what it kept (`Reused.Full`). Both are
      load-bearing (tested).
   2. **Accepted, fixed.** A `reactShape` given to `Tag.wrapper` drew the node's content in it and
      silently dropped the wrapped shape: it now throws ("use reactWrapper"), and a `reactWrapper`
      given as a shape says "use reactShape".
   3. **Accepted (tests only).** Nested React wrappers and a plain wrapper around a React one
      worked as traced; now tested.
   4. **Accepted, fixed.** A wrapper and the shape it wraps changing in one batch rebuilt the node
      twice: `rebuildShapes` now rebuilds each node tile once.
   5. **Accepted, fixed.** A wrapper whose component draws no `children` said they were "outside
      it": it now says the component must draw them.
   After the fixes: 32 cases × 3 browsers pass.
4. **React marks:** `reactMark`; `Decoration.Mark.shape`.
   **Done (2026-11-01).** Exported (`reactMark`, `ReactMarkSpec`, `MarkViewComponentProps`).
   `src/decorations/ReactMarkType.ts`, `src/components/marks/ReactMarkView.tsx`; `MarkView`
   dispatches to it. 13 cases in `src/__tests__/reactMark.browser.test.tsx`, in the three
   browsers: drawing, `getPos` and the document's mark; chrome and attributes from its own state;
   typing with the chrome changing before the flush; content React remounts (with a widget in it,
   drawn and connected once); a composition while the chrome changes; one component around a run
   holding another mark and an inline node; one per mark where values differ; the new mark after
   a change; an attribute-shaped mark made a React wrapper; chrome from the editor state in a
   selection-only flush; the element warning. Each mechanism
   below fails a test when disabled. The editing helpers the React decoration tests share moved
   to `src/testing/editing.ts`. Deviations and what was learned:
   - **The document's mark:** `Decoration.Mark.shape` clones the mark type, and Wordgard's walker
     gives a mark of the clone. Our `DecoIterator` copy records the document's mark behind it, so
     `markProps.mark.type` is the schema's type.
   - **Runs:** a React mark's element is the same for every value (only the reserved attribute),
     so runs merge, and views are kept, only when the marks are equal too. Plain Wordgard merges
     equal elements; it can't tell, as it draws no component.
   - **Rebuild:** a React mark's wrapper tile is rebuilt on its own (`rebuildMark`), not the node
     around it, whose rebuild keeps its content's tiles as they are. The rebuild code is shared
     (`rebuildContext`, `keepContent`, `replaceTile`).
   - **Compositions:** the wrappers around a composition are read from the tiles; a React mark's
     elements count as one wrapper, its root's, carrying the mark, and are React's, not the
     browser's.
   - **Content element:** holds only the content, as a textblock's: chrome there would be text
     that can't be told from the content's. `childCursor` throws on extra nodes.
   **Not done:** the cursor's marks (`wrapCursor`, typing with marks and no text yet) are drawn
   from the mark's own type, not a `Decoration.Mark.shape` override, as Wordgard's
   `ContentUpdate.composition` does: a React mark set by override isn't drawn around the buffer.
   **Audit (Fable, 2026-11-01)**, each finding checked against the code:
   1. **Accepted, fixed.** A flush with nothing to redraw (the selection moved) publishes the state
      without a build: a React mark, shape or wrapper drawing from the state (a link's toolbar
      while the cursor is in it) committed new chrome there, collected but never rebuilt, as
      `rebuildShapes` doesn't run in the flush. The chrome had no tile, and wasn't uneditable,
      until something next took the records. That branch now rebuilds what the commit changed
      (`rebuildRoots`). It predates marks (React shapes had it too). Tested; the test fails
      without the fix.
   2. **Rejected.** `holdsText` takes a React mark drawn in the document's content (around blocks)
      for one holding text. A conforming component never changes its content element's children
      outside the flush (the content element holds only the content), so the records it decides
      on can't come from React; treating them as typing is the safe default, and no test could
      fail on it.
   3. **Observation.** The tests compare with a fresh ReactWordgard; Fable cross-checked a React
      link against plain Wordgard (`domAtPos`, `posAtDOM`, `coordsAtPos`, the DOM selection read
      back): the same, the chrome aside. Its other probes (a run split by a lower-ranked React
      mark, nested React marks, a mark in a React shape remounting its content, a mark at the
      paragraph's end) passed.
   After the fix: 13 cases × 3 browsers pass.
5. **Hooks:** the list above.
6. **Tooltips:** `reactTooltip`.
7. **Docs:** the README (API, limits, migrating a react-prosemirror node view), CLAUDE.md,
   open-points; the R4 slice 6 entry in the plan.

Each step lands with its tests and the full suite green (`npm test`, three browsers), and the
benchmark smoke run (`npm run bench:smoke`).

## Tests

- **Stesura-like cases**, in `src/__tests__/`: a callout (title bar with its own state, shown or
  hidden by an attribute, content under `div.callout-body` via `contentDOMRef`); a table row
  providing a React context that makes its cells wrap their content in an extra element (the
  exact-row case, `docs/stesura-node-views-audit.md`), switched without the document changing.
- For each: the drawing and tile tree match plain Wordgard drawing the fallback `Elt` with the same
  structure (`drawing` in `src/testing/tiles.ts`); typing, deleting and an emulated IME composition
  inside the content while the chrome re-renders; the selection kept across a chrome re-render;
  Wordgard's next flush redraws nothing after a chrome-only commit; `wg-selected-node` and tag
  attributes arrive as props.
- Wordgard's own tests keep passing on ReactWordgard (`view` project).
- `renderedNodes` (`src/testing/renders.ts`): a chrome re-render renders no other node.

## Review (Fable, 2026-11-01)

Its findings, each checked against the code and folded into the sections above: the build's
same-view shortcut would keep stale tiles for a React shape re-rendering inside the flush;
`restore` would reset a React shape's attributes and undo its chrome for any record not filtered;
the rebuild must keep `tileViews`/`viewTiles` and use a DOM-driven walk (`childCursor` throws on
chrome); a wrapper makes a React shape an inner element; leaves can't have React shapes; marks are
always spanning wrappers; `useStopEvent` inverts `propagateEvent`. It confirmed the timing.

The open questions, decided with it:

- **The registry key:** a reserved attribute on a real element, not a custom element name, which
  would render inline in the fallback and break `target` selectors written against real element
  names.
- **A child component committing into the structure:** filtered by the replaced
  `MutationObserver`, which also covers attribute records; tiles rebuilt from its callback, a
  microtask after the commit.
- **Chrome inside the content element:** Wordgard's native model (its `buildNodeShape` puts a
  shape's elements around the hole as `NodeInner | Point` children of the content tile, and
  `resolve`, `posFromDOM`, `childRange`, `posAtCoords` and `ensureHackNode` handle them);
  `AfterContent` set by DOM order.

## What still changes in a Stesura node view

`node.attrs` becomes the node's param (Wordgard's model), `view` becomes `wg`, registration is a
tag decoration instead of `nodeViews`, and `innerDecorations` has no equivalent yet (only the
placeholder reads it). Decoration attributes arrive as React props, so Stesura's `STYLE` branch is
dead but harmless.
