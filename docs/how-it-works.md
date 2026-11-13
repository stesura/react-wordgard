# How react-wordgard, vue-wordgard and svelte-wordgard work (2026-11-13)

How the libraries draw Wordgard with React, Vue and Svelte, end to end, and the decisions behind it.
Most of it is told for React, the first view; [Vue](#vue) and [Svelte](#svelte) say where they
differ. Keep this file in step when the design changes.

## The idea in one paragraph

Wordgard draws its document itself: on each update (its *flush*), it diffs the change sections and
the decorations, and its `DocTile` rebuilds a *tile tree* (its view tree, one tile per DOM node it
owns) and writes the DOM. react-wordgard replaces that DOM writer: inside Wordgard's flush, React
renders the document, then we build Wordgard's tiles over the DOM React committed. Wordgard keeps
doing everything else (input, selection, composition, decorations, coordinates), reading our
tiles as if it had built them. The goal is that every
decoration taking a shape, a wrapper or a widget, plus marks, can be a React component in the
app's React tree. Tooltips and panels aren't: an app positions its own popovers (Floating UI and
the like) from `coordsAtPos`, in `useEditorEffect` or `useEditorLayoutEffect`.

## The packages

Four npm workspaces under `packages/`, released together at one version:

- `core` (`@stesura/wordgard-view`): everything that doesn't depend on a framework: the
  `Wordgard` subclass, the doc tile, the layout, the tile build, the decoration registrations,
  the stores. A framework plugs in through a renderer (`Renderer` in `tile.ts`). Not for apps:
  its API is what the views need, and changes with them.
- `react` (`@stesura/react-wordgard`), `vue` (`@stesura/vue-wordgard`) and `svelte`
  (`@stesura/svelte-wordgard`): a renderer each, the components it renders, the factories, the hooks
  or composables. Each depends on the core at its exact version.

The views reach the core through its entry (`core/src/index.ts`), as they will from npm. In the
workspace, every package's `exports` lead with an `@stesura/source` condition pointing at its
`src`, which TypeScript, Vite, Vitest and dependency-cruiser are given: types, tests, the demos and
the benchmark run on the working tree, never on a build. tsup builds each package's `dist`
(turbo orders the builds), at `npm pack`; svelte-wordgard ships its `.svelte` files for the app's
Svelte to compile, built by `svelte-package`.

## The pieces

Paths are under `packages/`.

| File | Role |
|---|---|
| `core/src/RenderedWordgard.ts`, `react/src/ReactWordgard.ts` | The `Wordgard` subclass, with no framework: a framework draws its first tree; its flush marks the framework's work and runs effects after it; it replaces Wordgard's `MutationObserver` (component shapes). `ReactWordgard` extends it with React's doc tiles, `VueWordgard` with Vue's. |
| `core/src/tile.ts` | `RenderedDocTile`, our `DocTile`, with no framework: lays out, has a renderer commit, builds the tiles over the DOM it committed, restores what the browser edited, rebuilds component shapes. |
| `react/src/ReactDocTile.ts` | React's renderer (`Renderer` in `tile.ts`): a root of its own or `WordgardDoc`'s portal, committing inside `flushSync`; `ReactDocTile`, the subclass `ReactWordgard` draws with. |
| `core/src/decorations/iterDeco.ts` | The layout: what to draw for each plot's content, from Wordgard's decorations, keeping what didn't change. |
| `core/src/decorations/DecoIterator.ts` | A copy of Wordgard's decoration walker, which the layout drives. |
| `core/src/changes.ts` | Helpers over Wordgard's change sections (kept, redrawn, replaced), indexed once per update. |
| `core/src/reactKeys.ts` | Keys per plot's children, mapped through changes (React's and Vue's). |
| `core/src/composition.ts` | Keeping an IME composition's text node alive through the flush. |
| `react/src/components/` | What React renders: `DocNodeView`, `ChildNodeViews`, `DefaultNodeView`, `MarkView`, `TextNodeView`, `WidgetView`, `ShapeView`, `WrapperView`, `ReactMarkView`, the hack nodes; `WordgardEditor` and `WordgardDoc` host the editor. |
| `core/src/decorations/widgetType.ts`, `shapeType.ts`, `wrapperType.ts`, `markType.ts`, `nodeWrapperType.ts` | What Wordgard sees of widgets, shapes, wrappers and marks a component draws: Wordgard widgets, `Elt`s and mark shapes registered by id, the handles of drawn shapes, `sortRecords`; the node wrappers' facet. No framework. |
| `react/src/decorations/ReactWidgetType.ts`, `ReactShapeType.ts`, `ReactWrapperType.ts`, `ReactMarkType.ts`, `ReactNodeWrapper.ts` | The factories (`createWidgetType`, `createShape`, …): React components registered under those ids. |
| `core/src/editorStore.ts`, `react/src/contexts/EditorContext.ts`, `react/src/hooks/` | The state store, effects and measures the hooks use (no framework), the context providing them. |
| `core/src/renderStore.ts` | Each content element's keys and node cells. |
| `core/src/decorations/decorationHandlers.ts`, `react/src/contexts/DecorationContext.ts`, `core/src/contexts/editorEvents.ts` | What the node view hooks use: each component decoration's handlers and position (no framework), the context giving them with its selection; the editor event listeners. |
| `core/src/words.ts`, `react/src/words.ts` | How the core's errors name the framework and what they advise, given by its renderer. |
| `core/src/wordgardInternals.ts` | The only file typing Wordgard's internals (with two `@ts-expect-error` in `RenderedWordgard.ts`). |
| `vue/src/` | vue-wordgard, the same pieces for Vue: [Vue](#vue). |
| `svelte/src/` | svelte-wordgard, the same pieces for Svelte, with a DOM renderer of its own: [Svelte](#svelte). |

## Creating an editor

Wordgard's constructor draws the document by calling `DocTile.create`. `ReactWordgard` (its base, `RenderedWordgard`) swaps that
function for the length of `super()`, so the first draw is React's (`ReactDocTile.create`, or
`ReactDocTile.host` for a hosted editor), then puts it back. It also withholds `parent` from the
base constructor: connecting the editor makes Wordgard measure, which React's draw needed again.
The editor goes into the page once built.

Two ways to host it:

- **Standalone** (`ReactWordgard.create`, used by Wordgard's copied tests and the benchmark): the
  editor's content element gets its own React root.
- **In the app's tree** (`<WordgardEditor>` + `<WordgardDoc>`): `WordgardEditor` creates the editor
  once (`useState`) and provides it through `EditorContext`. `WordgardDoc` renders the document
  through a portal into Wordgard's content element, so the document shares the app's contexts,
  then appends the editor's element into its `div`. The portal's element comes from a small
  external store (`docPortal`, `useSyncExternalStore`): the flush sets the element, React renders
  it. The portal's first commit builds the tiles (`ReactDocTile.mount`). One `WordgardDoc` per
  editor; a second throws.

## An update, step by step

A transaction is dispatched; Wordgard schedules a flush on the next animation frame (or runs one
at once when something needs layout, `ensureFlushed`). Then:

1. **`ReactWordgard.flush`** (`RenderedWordgard`'s) takes the DOM mutations still pending, sorts out React shapes'
   (below), rebuilds those shapes' tiles, sets `editor.flushing`, and calls Wordgard's flush.
2. **Wordgard's flush** reads the selection, takes the DOM mutations its observer saw
   (`takeDirty`: the browser's own edits), and runs `runUpdate` inside `observer.ignore`, so the
   DOM changes React makes there aren't read as edits.
3. **`docTile.update`** (Wordgard's) diffs the decorations and calls our **`updateRanges`** with the
   *change sections*: pairs of a length and kept (`-1`), redrawn (`-2`: marks or decorations
   changed, or DOM the browser edited) or replaced (a new length).
4. **Nothing to redraw?** (every section kept, no composition): publish the new state to the
   hooks' store and keep the same tile tree. That's a selection change, for instance.
5. **Restore** (`restore`): the tiles Wordgard's observer marked *Dirty* (the browser typed into
   them) get their DOM put back to what React committed, with Wordgard's own `sync()` plus
   attributes. React then diffs against what it believes is there. Not for a composition's text
   node, which stays as the browser left it.
6. **Keys** (`mapKeys`): every plot keeps an array of React keys for its children, mapped through
   the changes; unchanged ends copy their keys, and only the middle is walked node by node. A node whose start survived
   keeps its key; so does a retag (its opening token replaced by one of the same type, or a leaf
   in a replaced range of unchanged length), and a node moved within its parent (the same object,
   each old key used once). React then moves the moved node's DOM, and the build rebuilds its tiles
   over it, connecting its widgets anew, as Wordgard does for an inserted range.
7. **Layout** (`layout` → `iterDeco`): for each plot, what to draw (views: nodes, text, mark
   wrappers, widgets, hack nodes), walking Wordgard's decorations with `DecoIterator`, the way
   Wordgard's `ContentUpdate` builds tiles. Only what the changes touch is walked again:
   - a plot outside every redrawn range, in the same place, keeps its last layout object;
   - a *flat* plot (one node view per child: the document, block containers) keeps the views of
     its unchanged ends and walks the middle only (`unchangedEnds`);
   - `keepSame` keeps each old view that draws the same, so React can skip it (for a flat plot,
     in the middle only). A node that keeps its key keeps its *cell*, the place its component
     reads its view from; a node view that changed is handed to its cell, and a list whose keys
     each still hold the same view or the same cell keeps its *shape* (`shapeOf`).
8. **Render** (`render`, through the renderer's `commit`): inside `flushSync`, give the cells their new views
   (`publishCells`, which notifies their components), publish the state to the hooks' store and
   commit the document element. React renders only what changed: `ChildNodeViews` and `MarkView`
   are memoised on their list's shape, so typing in one of 5,000 paragraphs renders that
   paragraph (through its cell) and its ancestors, not the document's list; `DefaultNodeView`
   reads its view from its cell and listens to it (a class: no hook state per node),
   `TextNodeView` is memoised on its text.
   React still clones the fibers of the changed node's siblings on the way down, which no store
   avoids: that's what chunking long lists would cut. If React couldn't commit (a flush from
   inside a React render or commit), the update is refused (`RefusedUpdate`): the cells, the
   store and the element go back, the cells' new views stay pending for the retry, and Wordgard
   retries on its next frame. If a component throws, the document's error boundary unmounts it and
   the update throws that error; the next update lays out and builds the whole document as at
   first, with nothing restored or kept (so does the one after a component threw on its own).
9. **Build** (`build`): walk React's DOM alongside the views and build Wordgard's
   tiles over it (`addChildTiles`, `shapeTile`), the same tiles, flags and lengths Wordgard would
   build. A node view that's the same object as before keeps its old tile, read no further than its
   element's parent: React draws a kept view anew when a shape moves its content or the node's
   wrappers change, and its old element is then out of the page.
   The build keys only lists holding text or wrappers (`childViewKeys`): a list of blocks needs
   none.
   Native widgets, which React doesn't draw, are rendered or reused here and put in place
   (`placeWidgets`), then connected and disconnected as Wordgard would.
10. Back in Wordgard: it sets the DOM selection, runs its read/write phases (our measures run
    there), update listeners, and our `ReactWordgard.flush` runs the effects (`useEditorEffect`).

## What React renders

`DocNodeView` → `ChildNodeViews` (one element per view, keyed by `childViewKeys`) →
`DefaultNodeView` for a node, given its cell: its shape (`Elt`) as elements, the content in the hole (a keyed
`ChildNodeViews`), React widgets inside the shape as `WidgetView`. `MarkView` draws a wrapper (an
element-shaped mark, or the span carrying a text run's attribute-shaped marks; adjacent runs with
equal attributes share one span, as in Wordgard). `TextNodeView` is a bare text node.
`TrailingHackView` (`<br>`) and `SeparatorHackView` (`img.wg-buffer`) are Wordgard's `Widget.br` and
`Widget.img`. Native widgets render nothing in React; the build puts their DOM in place, and so
its block buffers (`Widget.blockImg`, `img.wg-blockBuffer`): Wordgard puts one beside an uneditable
block at either end of a block plot's content and between two (`ensureBlockSeparators`), which
needs each tile's `Uneditable` flag, known only once the DOM exists.

## The browser's own edits and compositions

Wordgard doesn't `preventDefault` typing: for `insertText`, inline deletions and all composition
input, the browser edits the DOM and Wordgard reads it back (its `DOMObserver`), for virtual
keyboards and Safari's autocapitalisation. So React's text nodes do get edited outside React.
Before rendering, `restore` puts them back to what React committed, so React's diff applies
cleanly; Wordgard's tests that type (`tile.browser.test.ts`, "follows the browser's own edit")
check the result matches plain Wordgard.

A composition's text node can't be touched, not even for a moment: the IME would end. So during a
composition the layout keeps that node as the browser has it (`composition.ts`): React keeps
rendering what it last committed there, or nothing when the browser created the node, and the
build gives it a tile flagged `Composition`, as Wordgard's `ContentUpdate.composition` does.

## Widgets

A **native widget** (`Widget.define`) is Wordgard's: its DOM comes from `render`, kept by the build
(`widgetDOM`) and placed among React's nodes. A **React widget** (`createWidgetType`) is a real Wordgard
`Widget.Type`, its `render` a placeholder (an empty span) only plain Wordgard draws; the React
view draws its component instead, in the editor's tree, with the app's contexts. Its root element (the forwarded
ref) is the widget's DOM. Wordgard ignores mutations inside widgets, so a React widget
re-renders freely; it must keep its root element. A non-`editable` widget's root is made
uneditable as Wordgard's `setUneditable` does: since 0.7.0, only a void element (an upstream bug),
which `WidgetView` sets before React inserts the root. `useNodePos` reads its position
from its tile.

A React widget drawing a node gets the node's attributes as props (the selected-node class, tag
and mark attributes). Wordgard wraps a widget in an element to add them, and a selection would
then move the component under a new parent, remounting it; our `DecoIterator` copy marks that
element (`attributeWidget`), and the view draws the widget alone in its place.

## Hooks and the store

`EditorContext` holds one value per editor (`editorStore.ts`), which never changes (memoised components are never
re-rendered by it): the editor, a store with the state *as of the last flush* (published inside
the flush, in the same commit as the document: hooks never see a state the DOM doesn't show), the
effects to run after the flush, and the measures. `useEditorState` and `useEditorStateSelector`
read the store; `useEditorEffect` runs after the flush (a plain React effect may run inside it,
before the tiles exist); `useEditorLayoutEffect` reads in Wordgard's read phase and writes in its write
phase, on the same paint; `useEditorEventCallback` gives a stable callback.

`useEditorEventListener` registers with the editor: `ReactWordgard` adds, at creation, a
`Wordgard.domEventHandler` at the highest precedence for each of a fixed list of event types
(`core/src/contexts/editorEvents.ts`; Wordgard has a handler per type, and handlers make its listeners
non-passive, so scroll-blocking events are left out), which runs the registered listeners, the
latest first. A state taken from another ReactWordgard already has them: Wordgard keeps one copy
of an extension. A `GardState.reconfigure` drops them; the next flush puts them back. The
extension carries a no-op plugin, as Wordgard redoes its handlers only when its plugins change.

**The node view hooks.** Each React decoration (`ShapeView`, `WrapperView`,
`ReactMarkView`, `WidgetView`) provides a `DecorationContext`: its `getPos` (`useNodePos`),
whether its node is selected (`useIsNodeSelected`, `useSelectNode`), and the sets its components'
`useStopEvent` and `useIgnoreMutation` register into, keyed by its root element too.
- `useStopEvent` feeds `propagateEvent`: the chrome's widget type's and every React widget type's
  ask the decorations around the event's target, up to its editor's content element (an editor
  nested in a decoration isn't its). Wordgard checks it before its handlers, so a stopped event
  reaches no handler or keymap, and keeps its default. A React shape's, wrapper's or mark's root
  and structure (not its content element) have tiles of an `EltTile` subclass whose `ignoreEvent`
  asks too, for events targeting that element itself. Events in plain content aren't asked.
- `useIgnoreMutation` is asked in `sortRecords`, for the records that would reach Wordgard, up to
  the editor's content element too.
- The selection is read from the class Wordgard draws a node selection with (`wg-selected-node`,
  anywhere in the node's shape: a point wrapper may sit around it), so the components render with
  it; `useSelectNode` runs its callbacks after the flush that draws the change.

## React shapes

A **React shape** (`createShape(component)`) is a real Wordgard `Elt`
(`<blockquote data-wg-component="1">[0]`), registered as drawn by a component. Wordgard reasons about
the `Elt` (whether the node is an atom, where its content goes, `target` selectors, merging
attributes); React draws the component. The registration is a reserved attribute because Wordgard
copies `Elt`s when it adds attributes or wraps them, and every copy keeps their attributes.
`createShape` returns a function of the tag, a form `Tag.shape` takes (Wordgard caches its result
by tag): it builds the `Elt` from the tag's node type's own `NodeShape`, the outer element's tag
and attributes, and a hole unless the type draws an atom. So the config reads as Wordgard's own,
`Decoration.Tag.shape(Image, ImageShape)`, and the type is never passed twice. `.of(element,
{atom})` is the `Elt` itself, for `Point.shape`, which applies to whatever node follows.

**The root's tag.** Wordgard applies decorations to the `Elt` before anything is drawn: `target`
selectors match its tags, wrappers and attributes go on its elements. So the tag has to be known up
front, and the component can't say it: its root exists only once it has rendered, which needs the
node, its content and the editor's contexts, and may differ per node (a heading's level). The node
type already says it, per node, so the shape takes it from there. The component must draw that
element and keep it; `reactShapeTile` (and the wrapper and mark builds) log an error, once per
mismatch, when a committed root's tag differs (`warnElement`). react-prosemirror never needed
this: a node view replaces `toDOM`, ProseMirror builds its view description from whatever DOM the
component drew and puts node decorations' attributes on it afterwards, and no selector is matched
against a shape model, nor is the same config drawn by plain ProseMirror.

**`DecorationRoot`.** So the component doesn't have to repeat that tag, `ShapeView`, `WrapperView`
and `ReactMarkView` put the root's tag, Wordgard's attributes and the root's ref in a context
(`DecorationRootContext`), and `DecorationRoot` renders them, the component's props merged in.
`WidgetView` does the same for a React widget, its tag the type's `element` (Wordgard doesn't look
at a widget's element) and its attributes those of the node it draws, if any. The merging:
`className` joined, `style` merged (Wordgard's comes as a string, parsed then), anything else the
component's. The ref comes through the context, so the component itself needs none: the factories
give it `ref` only where React can (React 19, or a `forwardRef` component), which spares React 18
its warning for a function component given a ref. A hand-written root still gets `ref` and the
attributes as props.

The component gets react-prosemirror's props, named after the decoration
(`ShapeComponentProps`): `nodeProps` (`node`, `getPos`, `contentDOMRef`), `children` (the
content), a forwarded `ref` for its root, and the decorations' attributes as props.

**Tiles.** The build walks the component's DOM, not the shape: the root is the node's tile, the
elements from the root down to the content element (`contentDOMRef`, else the root) are its
structure, and every other DOM node is *chrome*: an uneditable widget tile over a private widget
type, as Wordgard models a widget inside a shape. So selection, coordinates and positions treat
chrome like any widget in a shape, and Wordgard ignores mutations inside it. In a container (a
plot holding blocks), chrome may also sit in the content element, before or after the content:
the content's DOM there is all elements React drew for nodes, mark wrappers and widgets
(`viewRoots`), so anything else is chrome. A textblock's content element must hold only the
content: its text can't be told from chrome text. A shape without a hole draws an atom: its root's
tile has the `Atom` flag, there's no content element (a `contentDOMRef` throws), and everything
under the root is chrome; the handle's `atom` (set through the root's ref) has `sortRecords` take
child changes on the root for structure. A shape the editor state changes is rebuilt in
the flush's build, or, in a flush with nothing to redraw (the selection moved), right after
React's commit there; one the component changes on its own, below.

**The component's own commits.** A component re-rendering from its own state, a context or a store
commits outside Wordgard's flush. Wordgard's observer would read that as a user edit, mark the node
Dirty, and our `restore` would undo React's chrome. So `ReactWordgard` replaces Wordgard's
`MutationObserver` with one that sorts the records first (`sortRecords`): inside a React shape it
drops everything that isn't a content edit (records under chrome, attribute changes on its
elements, child changes on its structure) and notes which shapes' structure changed. Child
changes on a content element are React's in a container (typing never adds or removes blocks
there); in a textblock they're typing, unless the same batch shows React moving the shape's content
to another element (React remounting it), since a batch is one task's and typing comes in tasks of
its own. A content React remounts is built again from its views, the old content's widgets reused
(their DOM, which React doesn't move, taken out of the old element first). Those shapes'
tiles are rebuilt over React's DOM, keeping the content's tiles: whenever records are taken outside
the flush (the observer's callback a microtask after the commit, before a flush, Wordgard's own
`clear` in `focus`), or inside the flush's build, which then doesn't reuse their old tiles. The
rebuild and the build discard the records of their own DOM work (widget DOM moved, strays
removed), as Wordgard's flush does inside `ignore`, and the rebuild detaches the replaced tile so
Wordgard can't reach it again. This is react-prosemirror's design adapted: it switched ProseMirror's observer off
and handled all typing itself; Wordgard needs its observer for typing, so only React's own
mutations are filtered out.

## React wrappers

A **React wrapper** (`createWrapper(component, {element})`) is the same idea for `Tag.wrapper` and
`Point.wrapper`: a real `Elt` with a hole, registered by the reserved attribute. Wordgard fills the
hole with what it wraps (the node's shape, or the element `target` picks in it), so the wrapper's
`Elt` holds one child. The component gets `WrapperComponentProps`: a React shape's props
without `contentDOMRef` (`nodeProps` with `node` and `getPos`, `children`, `ref`, attributes).

`DefaultNodeView` draws what's wrapped with a ref on its root (`outerRef`, through `ShapeView`
and `WidgetView` too), so the wrapper's handle knows the wrapped element as a shape's knows its
content element. The tile build is a React shape's (`reactShapeTile`), walking down to the
wrapped element instead of the content element: the elements on the way are structure, the rest
chrome, and the wrapped element gets the tiles of the `Elt` or React widget it draws. The record
sorting stops at a wrapped element, as at a content element: what happens in it is the wrapped
node's (Wordgard's mutations, or an inner React shape's). A wrapper around a React shape is
rebuilt once, from the node's tile down, whichever of the two changed. When the component moves
its `children`, React may remount what's wrapped, or keep its element as new structure when the
names match; either way, native widget DOM the old wrapped tree held comes out before the walk, as
for a shape's remounted content, and the rebuild disconnects what it didn't keep.

Limits: a React wrapper can't wrap a node a native widget draws (React drew nothing there, so the
component's `children` can't be found; draw the node with a React widget), nor text. Around an
atom, the wrapper's root is made uneditable, as Wordgard makes a shape without a hole.

## React marks

A **React mark** (`createMarkShape(component, {element})`, `span` by default) is a mark's element shape
(`Shape.Element`) carrying the reserved attribute, for `Decoration.Mark.shape` or a mark type's
own spec. A React mark replacing an attribute-shaped mark makes it element-shaped, so spanning. The
component gets `MarkComponentProps`, react-prosemirror's: `markProps` (`mark`, `getPos`,
`contentDOMRef`), `children`, `ref`.

`mark` is the document's: `Decoration.Mark.shape` hands Wordgard's walker a mark of a type it
clones, so our `DecoIterator` copy records the document's mark behind it (`documentMark`). The
layout's wrapper views carry it, and a run merges into the previous one only when the marks are
equal as well as the elements (a React mark's element is the same for every value), so each
component draws one run of one mark. `MarkView` draws a React mark through `ReactMarkView`.

**Tiles.** The root is the wrapper tile (spanning as the mark is); each element down to the content
element (`contentDOMRef`, else the root) is a nested wrapper tile, which Wordgard's `resolve` walks;
everything else is chrome, a point widget. The content element holds only the content (inline
text can't be told from chrome text). A composition inside a React mark sees its elements as one
wrapper, the root's, with the mark (`domWrappers`). The record sorting is a React shape's (the mark
registers the same handle); when a mark's structure changes outside the flush, its wrapper tile is
rebuilt (`rebuildMark`), keeping the content's tiles or building them again from the views where
React remounted the content, with its leftover widget DOM taken out first.

## Vue

vue-wordgard (`packages/vue/src/`) is the same design over the same core: `VueWordgard` extends
`RenderedWordgard`, `VueDocTile` is Vue's renderer, and the components mirror React's
(`DocNodeView`, `DefaultNodeView`, `ChildNodeViews`, `MarkView`, `ShapeView`, …). The tile build,
the record sorting, the layout and the keys are the core's, unchanged. What differs comes from
three things Vue does that React doesn't:

- **Anchors.** Vue marks the ends of a fragment (several roots, a `<slot/>`, a list) with empty
  text nodes, and a `v-if` with a comment. Wordgard reads positions by DOM child index and its
  `sync()` removes nodes without a tile, so no anchor may sit among a content tile's children. So
  child lists are functions returning vnodes, an element's own children, not components; every
  component has one root; the document is drawn with `render()` into the content element, whose
  `_vnode` (Vue's record of what it last drew there) is seeded with a vnode for the element itself,
  so Vue patches its children as an element's, without a fragment's anchors. Users' components meet
  the same rule: the content is a component, `NodeContent` (or `DecorationRoot content`), never a
  `<slot/>`; `DecorationRoot`'s and `NodeContent`'s slots drop `v-if`'s comments and flatten
  fragments; a content element or a mark's elements holding an anchor throws. In a shape's own
  structure, a comment gets a chrome tile, as text and elements do.
- **Commits come later.** Vue renders a component whose state changed in a later job, which would
  commit outside the flush. `sync.ts` replaces the scheduler of each component in the document
  (ours explicitly, the app's through a mixin on the document's app context) to record it, and the
  renderer renders the recorded ones inside the flush, parents first (`instance.update()`), a child
  its parent drew skipped. Per-node updates use the core's cells as React does: `DefaultNodeView`
  holds its cell's view in a `shallowRef`, and `VueDocTile` calls `render()` only when the
  document's list changed shape. A list isn't a component, so `drawList` gives Vue the same vnodes
  again while a node's shape `Elt` and its list's shape are unchanged, and Vue's `patch` returns at
  once on the same vnode (`vnode.memo` keeps Vue from cloning it), where React's memo skips.
- **No error boundary, no render phase.** A flush forced from inside any Vue component (setup,
  render, a hook) is refused with `RefusedUpdate` and drawn on the next frame, as React's from
  inside a render or commit. An error a document component throws is logged and reported; the next
  commit draws the content element empty, then the whole document.

**Hosting.** `WordgardEditor` creates the editor (`VueWordgard.host`) and provides it.
`WordgardDoc` draws a `div` and, in its `onMounted` (inside Vue's post-flush pass, where
`render()` runs no other component's pending callbacks), renders the document into the content
element, builds the tiles and appends the editor. The document's top components get an app context
of their own (`documentContext`), inheriting the host app's and its provides chained under
`WordgardDoc`'s, so `inject` reaches the app's. Components outside the document get a published
state after the flush (`onPublish`), and render in Vue's next tick: same paint, not inside the
editor's update.

**Decorations.** The factories register the same `Elt`s, widget types and mark shapes as React's,
with a Vue component. Wordgard's attributes fall through to the component's root (classes joined,
styles merged, Wordgard's winning for the rest), so `DecorationRoot` only spares the tag. A wrapper
draws what it wraps as `WrappedNode`, a node wrapper too (its root, so its attributes fall through
to the node's root element: no `NodeRootProps`). Refs are set from directive hooks inside the
patch: Vue sets template refs in a post-flush job, too late for the build.

**Vue internals it relies on**, to re-check at every Vue update (the peer is `~3.5.45`):
`container._vnode`, `instance.update()` and a component's `effect.scheduler`, `vnode.memo`, a
component's `provides`, and the app context's `optionsCache`, `propsCache` and `emitsCache`.

## Svelte

svelte-wordgard (`packages/svelte/src/`) is the same design over the same core: `SvelteWordgard`
extends `RenderedWordgard`, `SvelteDocTile` is its renderer, and the tile build, the record sorting,
the layout, the keys and the cells are the core's. What differs comes from Svelte's templates,
which can't draw Wordgard's lists: every element holding a block, a component or a snippet gets an
anchor (an empty text node for an `{#each}`, a comment for the others), and `mount` puts one in its
target. Wordgard reads positions by DOM child index and removes nodes without a tile, so none may
sit among a content tile's children.

- **A DOM renderer of our own.** Nothing Wordgard draws is a Svelte template.
  `components/ChildNodeViews.ts` draws a plot's children as keyed parts (text, mark elements, hack
  nodes, nodes) over the core's keys, `DefaultNodeView.ts` a node's shape `Elt`, `MarkView.ts` a
  mark's element; `helpers/dom.ts` sets attributes only when they change, with Wordgard's
  namespaces, and `placeNodes` orders our nodes with as few moves as it can, leaving the others
  (widget DOM, a composition's text node) where they are. A text node is written only when its
  text differs from what we last wrote. Per-node updates come from the cells: a list keeping its
  shape isn't drawn, and a node whose cell got a new view draws itself after the lists. An element
  of another tag in place of one (a mark's `strong` becoming `em`, a heading's level) takes the old
  one's children, as Wordgard's own update does.
- **A root per component.** Each Svelte decoration is mounted (`mount`) inside
  `components/Decoration.svelte`, a `<svelte:boundary>` reporting to `failed`, with the editor's
  element as `target` (where Svelte's delegated events listen) and an anchor in a detached holder
  (`helpers/mountRoot.ts`): what Svelte puts beside the root stays in the holder, and the root
  element, the only one, is moved into place. Its contexts are passed by hand: `WordgardDoc`'s, or
  the enclosing component's, read where its `contentDOMRef` runs. A root Svelte replaces (a block at
  the component's top switching, `<svelte:element>`'s tag changing, an HMR update) is drawn in the
  holder, where a `MutationObserver` finds it; the core rebuilds the tiles over the new root
  (`core/src/decorations/replacedRoots.ts`). The renderer unmounts nested roots, putting each root
  back in the holder first: Svelte removes an effect's nodes by siblings, wherever the first is.
- **Content by attachment.** A component marks its content element with `contentDOMRef`, and a
  wrapper what it wraps with `wrappedDOMRef` (`helpers/slot.ts`); the renderer draws there once the
  attachment ran, from its own queue rather than inside the attachment's effect (a root mounted
  there would be that effect's child, which Svelte can stop updating), drained in the commit before
  Wordgard reads the DOM. A node wrapper is mounted with no root element: its `WrappedNode` hands
  the node its contexts and its attributes (`components/NodeWrapperView.ts`).
- **The commit.** The renderer commits in `flushSync`, which runs every pending effect of the page:
  components outside the document get the state after the flush (`helpers/publish.ts`), so their
  effects run outside it. A flush forced from inside a reaction (`getAbortSignal()` doesn't throw
  there) is refused with `RefusedUpdate`, as Vue's from a component. An error a component throws,
  in a later update of its own too, reaches its boundary; the document is drawn anew at the next
  update.

**Hosting.** `WordgardEditor` creates the editor (`SvelteWordgard.host`) and sets it as a context;
on the server (`esm-env`'s `BROWSER`) it creates none and draws nothing, and its children are drawn
in the browser as the page hydrates, which discards the server's empty `{#if}` branch.
`WordgardDoc` draws a `div`, puts the editor in it from an attachment, then draws the document
inside Wordgard's `observer.ignore`, with its own contexts. Unmounting it unmounts every component
the document drew.

**Svelte behaviour it relies on**, none of it API (the peer is `~5.57.3`): where `mount` puts what,
given an anchor; a single-element root updated and unmounted after it moved; a replaced root drawn
in the holder; `<svelte:element>`'s comment and inner text node; delegated events through the
target; when attachments run, run again and are torn down; `flushSync` from an attachment; a
boundary's `onerror` timing; a root mounted inside an effect being its child; `$effect.pre` running
at setup; an effect's nodes removed by siblings, and the old root of nested blocks left in place.
`packages/svelte/src/__tests__/svelteBehaviour.browser.test.ts` checks each, in the development,
production and async builds (the `view-svelte`, `view-svelte-production` and `view-svelte-async`
projects); `.github/workflows/svelte-latest.yml` runs them weekly on Svelte's latest release, with
async mode in production besides (`view-svelte-async-production`, out of `npm test`), and
`npm run test:svelte-hmr` drives HMR on the demo's dev server.

## Decisions

| Decision | Why |
|---|---|
| Follow Wordgard's API, not react-prosemirror's `nodeViews`; React decorations keep react-prosemirror's prop names. | The library makes Wordgard's concepts drawable by React; Stesura's node views port with few changes. |
| React draws inside Wordgard's flush (`flushSync` in the renderer's `commit`, from `updateRanges`). | Wordgard ignores mutations only inside its flush, and reads layout right after. |
| Tiles built over React's DOM, real tile objects. | Wordgard's input, selection and coordinates code walk tiles and check their classes and flags. |
| Let the browser's edits through, `restore` before rendering. | Wordgard types through native DOM edits on purpose. |
| Keys from change sections, per parent plot. | No positions needed to render; kept plots keep keys for free. |
| Lay out changed sections only; draw once at load. | Per-keystroke cost; Wordgard's first draw was wasted. |
| Host the editor in the app's tree through a portal. | The app's contexts reach React widgets and shapes. |
| Wordgard as a peer dependency, exactly `0.7.0`. | Two copies break Wordgard's `instanceof` checks; we use its internals, which even a patch can change (react-prosemirror pins `prosemirror-view` exactly too). |
| React shapes as `Elt`s registered by a reserved attribute on a real element. | Survives Wordgard's copies; keeps `target` selectors and the fallback valid. |
| A React shape's root from its node type's own shape, per tag; `element` only for wrappers, marks and `Point.shape`. | Wordgard needs the tag before React draws, and the type already says it (a heading's per level); a mismatch logs in development. |
| `DecorationRoot` draws a decoration's root from a context, a hand-written root still allowed. | The tag, the attributes and the ref can't be forgotten or wrong, and no `forwardRef` on React 18; a hand-written root keeps per-element typing and full control. |
| Atoms as React shapes without a hole, not widgets. | Wordgard's own atom shape: the attributes go on the root, so a selection doesn't remount the component, and every node's component gets the same props. |
| Chrome as uneditable widget tiles. | Wordgard's own model for a shape's elements around its hole. |
| Replace Wordgard's `MutationObserver`; rebuild changed shapes from the records, no layout effect. | A component's own commits must never reach Wordgard as edits; a component re-rendering alone doesn't run its parent's effects. |
| Hook event listeners run before keymaps (highest precedence). | As react-prosemirror's `handleDOMEvents`; Stesura needs keydown first. |
| One repository, four packages: the core published on its own, the views pinning it exactly, all released at one version. | The core reaches Wordgard's internals for every view: one change runs every view's tests, and an app gets one copy of it. |
| Vue's document drawn with `render()` into a content element whose `_vnode` is seeded, committed with `instance.update()` inside the flush. | No anchors among Wordgard's tiles; Vue would otherwise commit after the flush, read by Wordgard as edits. Both are Vue internals. |
| Vue's content is a component (`NodeContent`), not a slot. | A slot puts anchors in the content element, beside the text. |
| Svelte's document drawn by a DOM renderer of our own; each Svelte decoration a root of its own (`mount`), its anchor in a detached holder, its root element moved into place. | Svelte's templates put an anchor in any element holding a list, a block or a component, and `mount` one in its target: none can sit among Wordgard's tiles. Zero-length tiles for anchors would have changed the core for every view. |
| A Svelte decoration marks its content element with an attachment (`contentDOMRef`), never `{@render children()}`. | A snippet leaves a comment where it renders. |
| Svelte's view tested in its development, production and async builds, and weekly on Svelte's latest release. | It relies on Svelte's behaviour (anchors, `flushSync`, `mount`), which no contract covers and which differs between builds. |

## What we depend on in Wordgard

All typed in `packages/core/src/wordgardInternals.ts`, re-read after `npm run update-wordgard`: the tile classes
(taken from a tree Wordgard builds), `TileFlag`, the decoration classes and facets, `DocTile.create`
(swapped in the constructor), and, since React shapes, the `DOMObserver`'s `observer` and `queue`
and `scheduleFlush`. A Wordgard release changing any of these can break us: the peer is pinned
exactly, and the copied Wordgard tests (`test/wordgard/`, the `view` project runs them on
`ReactWordgard`, `view-vue` on `VueWordgard`, `view-svelte` on `SvelteWordgard`) are the alarm at
`npm run update-wordgard`. Some of this would go if Wordgard
took the renderer from the subclass before its first draw, mapped positions over bare change
sections publicly, or offered a renderer interface.
