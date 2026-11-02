## Unreleased

### Breaking changes

`createWidgetType` no longer takes a `render` function: React draws its widgets, and plain Wordgard, given one, draws an empty placeholder.

The component props types drop "View": `ShapeComponentProps`, `WrapperComponentProps`, `MarkComponentProps` and `WidgetComponentProps`.

`createShape` takes the component alone, no `element`: its shape, for `Decoration.Tag.shape`, takes the root from the node type's own outer element for each node, and `shape.of(element)` gives one for `Decoration.Point.shape`.

`createWrapper` and `createMarkShape` take the component first, then `{ element }`, and `createMarkShape` has no mark parameter type.

On React 18, a React shape's, wrapper's or mark's component that is a plain function is no longer given a `ref`, which React 18 can't pass to it.

### Bug fixes

A React decoration's component drawing its root by hand gets Wordgard's style as an object in `style`, which it can merge with its own, instead of a `STYLE` string that overwrote it.

Two adjacent leaves retagged in one transaction (an image's `src` changed beside another's) keep their components, as a single retag does.

### New features

`createWidgetType` infers its value and element types from its component.

`createShape`, `createWrapper` and `createMarkShape` give the same value for the same component (and `element`), and register it once.

A `useEditorLayoutEffect` read returning `undefined` skips its write, and when no read asks for a write none is scheduled, sparing Wordgard a second measure.

`useStopEvent` is also asked for events on a React decoration's own elements (its root, unless it is the content element, and the elements around its content element: an atom's root, a frame's padding), never for those in its content.

A node moved within its parent (deleted and inserted again, the same object, in one transaction) keeps its React shapes', wrappers' and marks' components and those inside it; React point widgets inside it are drawn anew, as Wordgard redraws them.

A React shape can draw an atom (an image, a mention, a plot drawn as one), its component getting the node and its attributes, everything it draws chrome.

A React widget's component can draw its root with `DecorationRoot`, a `span` unless `createWidgetType` gets another `element`, with no `forwardRef` on React 18 and, for a widget drawing a node, the node's attributes.

`DecorationRoot` draws a React shape's, wrapper's or mark's root: the tag its decoration says, Wordgard's attributes and the root's ref, merged with the component's own props, with no `forwardRef` needed on React 18.

## 0.1.0 (2026-11-01)

### New features

First release: React draws Wordgard's documents inside Wordgard's own update, in the app's React tree, and Wordgard keeps handling input, selection, composition and decorations.

Requires `wordgard` ~0.6.2 and React 18 or 19.

`WordgardEditor` creates an editor and provides it to its children; `WordgardDoc` puts it in the page and renders its document through a portal, so the app's contexts reach what it draws.

`createWidgetType` defines a Wordgard widget type drawn by a React component, usable wherever Wordgard takes a widget; one drawing a node gets the node's attributes as props.

`createShape` makes a node's shape (`Decoration.Tag.shape`, `Decoration.Point.shape`) a React component that renders the node's content as `children` and may change the elements around it on its own.

`createWrapper` does the same for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`, and `createMarkShape` for a mark's shape (`Decoration.Mark.shape`, or a mark type's own).

`useWordgard`, `useEditorState` and `useEditorStateSelector` read the editor and its state as of its last update.

`useEditorEffect` runs after the editor's update; `useEditorLayoutEffect` reads and writes within it, on the same paint as the document; `useEditorEventCallback` gives a stable callback getting the editor.

`useEditorEventListener` handles the editor's DOM events before Wordgard's own handlers and keymaps.

`useNodePos`, `useStopEvent`, `useIgnoreMutation`, `useIsNodeSelected`, `useSelectNode` and `useMergedDOMRefs` give React decorations what react-prosemirror's node views had.

The package ships a skill for AI coding agents, `skills/react-wordgard/SKILL.md`, on building editors with Wordgard and react-wordgard.
