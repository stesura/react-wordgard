## Unreleased

### Breaking changes

`createWidgetType` no longer takes a `render` function: React draws its widgets, and plain Wordgard, given one, draws an empty placeholder.

The component props types drop "View": `ShapeComponentProps`, `WrapperComponentProps`, `MarkComponentProps` and `WidgetComponentProps`.

### New features

A React widget type's `shape(nodeType, value?)` draws a node type as its widgets, their value the node's parameter or what `value` makes of its tag.

`createWidgetType` infers its value and element types from its component.

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
