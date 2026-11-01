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
type NodeViewComponentProps = AllHTMLAttributes<HTMLElement> & {
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
`useMergedDOMRefs(ref, contentDOMRef)` keep typing. The names (`NodeViewComponentProps`,
`nodeProps`, `contentDOMRef`) are react-prosemirror's, so a Stesura node view keeps its signature; what changes is what's inside `node` (Wordgard's model) and
the registration (a tag decoration instead of `nodeViews`). `decorations` and `innerDecorations`
are ProseMirror's: left out until a case needs a Wordgard equivalent.

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
hold for it: `ReactNodeView`'s layout effect marks its root after every commit (a `WeakSet` of
roots), inside the flush or not, and the build rebuilds marked nodes. Every rebuild, inside or
outside the flush, keeps `tileViews` and `viewTiles` in step, and replaces the tile in its parent
by splicing `children` and setting `parent` (a synced parent's `addChild` throws), as
`keepComposing` does.

### The component's own commits

Wrapped in our `ReactNodeView` (react-prosemirror's name), the component re-renders inside
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
2. **The tiles, in a layout effect.** `ReactNodeView`'s layout effect, without dependencies, runs
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

### Hooks node views use

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
  creation, dispatching to the hooks registered. Its precedence against keymaps to settle
  (Stesura's section break needs keydown first).
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
2. **React shapes:** `reactShape`, `ReactNodeView`, the tile build, the commit handling, the flush
   fallback; `Tag.shape` and `Point.shape`.
3. **React wrappers:** `reactWrapper`; `Tag.wrapper` and `Point.wrapper`.
4. **React marks:** `reactMark`; `Decoration.Mark.shape`.
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
