## Unreleased

### New features

`useEditorField(field, select?, isEqual?)` reads a state field or derived field, and `useEditorFieldEntry(field, key)` one entry of a field holding a `Map`. The editor's store compares each subscribed field once per flush and tells only its subscribers, so a component reading a field doesn't run anything on a flush that leaves the field as it was, where `useEditorStateSelector` reruns every selector on every flush. Both follow a `WordgardScope` to another editor.

### Bug fixes

SVG and MathML in shapes and decorations, such as the handle Wordgard's `imageResizing()` draws on an image, render in their namespace, with no React warnings: `svg:path` was drawn as an unknown `<svg:path>` element, `stroke-width` wasn't passed as `strokeWidth`, and a `style` attribute on them was dropped. A node type's shape can now hold SVG or MathML inside an `svg:svg` or `math:math` element.

## 0.2.1 (2026-11-05)

### New features

The package's entry point is marked `"use client"`, so frameworks with React Server Components treat it as client code.

## 0.2.0 (2026-11-05)

### New features

`WordgardScope` gives the components it holds an editor another `WordgardEditor` made, in place of the one around them: a toolbar acting on whichever of a page's editors has focus. Its hooks follow when the editor changes, and `useEditorEffect` runs again for a new editor.

## 0.1.0 (2026-11-03)

### New features

First release: React draws Wordgard's documents inside Wordgard's own update, in the app's React tree, and Wordgard keeps handling input, selection, composition and decorations.

Requires `wordgard` ~0.6.2 and React 18 or 19.

`WordgardEditor` creates an editor and provides it to its children; `WordgardDoc` puts it in the page and renders its document through a portal, so the app's contexts reach what it draws.

`createShape` makes a node's shape (`Decoration.Tag.shape`) a React component that renders the node's content as `children` and may change the elements around it on its own; its root is the node type's own outer element, and `shape.of(element, { atom? })` gives one for `Decoration.Point.shape` or another root.

A React shape can draw an atom (an image, a mention, a plot drawn as one), its component getting the node and its attributes, everything it draws chrome.

`createWrapper` does the same for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`, and `createMarkShape` for a mark's shape (`Decoration.Mark.shape`, or a mark type's own), each taking the component and an `element` for its root.

`createWidgetType` defines a Wordgard widget type drawn by a React component, usable wherever Wordgard takes a widget, its value and element types inferred from the component.

`DecorationRoot` draws the root of a React shape, wrapper, mark or widget: the tag its decoration says, Wordgard's attributes and the root's ref, merged with the component's own props, with no `forwardRef` needed on React 18.

A component can draw its root by hand instead, from the ref and Wordgard's attributes it gets as props, its style as an object to merge with its own.

`createShape`, `createWrapper` and `createMarkShape` give the same value for the same component (and `element`).

A component keeps its state through a mark change on its node, a retag of the node's opening token, and a move within its parent (the same node object deleted and inserted in one transaction); replacing the node, changing its type or moving it to another parent remounts it.

`useWordgard`, `useEditorState` and `useEditorStateSelector` read the editor and its state as of its last update.

`useEditorEffect` runs after the editor's update; `useEditorLayoutEffect` reads and writes within it, on the same paint as the document, a read returning `undefined` skipping its write; `useEditorEventCallback` gives a stable callback getting the editor.

`useEditorEventListener` handles the editor's DOM events before Wordgard's own handlers and keymaps.

`useNodePos`, `useStopEvent`, `useIgnoreMutation`, `useIsNodeSelected`, `useSelectNode` and `useMergedDOMRefs` give React decorations what react-prosemirror's node views had; `useStopEvent` is asked for events in a decoration's chrome, on its own elements and in React widgets, never in its content.

The package ships a skill for AI coding agents, `skills/react-wordgard/SKILL.md`, on building editors with Wordgard and react-wordgard, with a reference on Wordgard's model for ProseMirror developers.
