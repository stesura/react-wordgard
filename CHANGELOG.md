## 0.3.0 (2026-11-11)

### Breaking changes

react-wordgard now draws for `wordgard` 0.7.0, and its peer dependency is `0.7.0` exactly, where it allowed `~0.6.2`: react-wordgard uses Wordgard's internals, which any release can change.

A non-editable widget's root, React's or not, gets `contenteditable="false"` only when it's a void element (`img`, `br`, `hr`, `input`, `wbr`), as Wordgard 0.7.0 draws widgets. A React widget drawing a node with attributes (a selected one, say) still gets it, as Wordgard makes the element it wraps such a widget in uneditable. Wordgard still keeps the others from being edited; set the attribute yourself where a style or a script reads it.

### New features

`nodeWrapper(NodeType, component)` puts a component around every node of a type that renders no element of its own: its `children` is the node's drawing. It hands the node's shape data through a context and re-renders on its own without drawing the node again, where `createWrapper` draws an element. A reconfiguration that changes the wrappers draws the whole document again; one giving them again unchanged does nothing. Text can't be wrapped.

`nodeWrapper` also takes a function picking node types, asked once per type: a fallback wrapper for every block type an extension has no wrapper of its own for. `NodeRootProps`, in a node wrapper, gives the element of a node Wordgard draws a class, a style and attributes; a React shape draws its own root and ignores them.

`isTrailingBreak(dom)` tells the `<br>` Wordgard ends a textblock with from a line break's, which Wordgard draws the same.

`staticCopy(dom)` copies what an editor drew, to lay out as it does elsewhere: without ids or the editor's own attributes, its trailing breaks classed `wg-trailing-break`.

### Bug fixes

An uneditable block at the start or end of a block's content, or next to another, gets an `<img class="wg-blockBuffer">` beside it, as in Wordgard 0.7.0, so Chrome and Safari keep editing when the cursor lands there.

An inline atom no longer has a buffer image after it, and buffer images have an empty `alt`, as in Wordgard 0.7.0.

A point decoration's shape keeps the attributes and wrappers of the node's marks and of tag and range decorations.

A non-editable React widget's root that Wordgard makes uneditable is drawn with `contenteditable="false"` from the start, before React puts it in the page. It was set afterwards, and on a page with some `:has()` rules (Tailwind's `group-has-*` classes) Chromium then rechecked the whole document's style for each widget: a 350-page document with thousands of list labels took six minutes to load into a live editor, and now takes five seconds.

A React shape, wrapper, mark or widget drawn again with the same attributes keeps its `DecorationRoot`'s context value. A node whose attributes come from a decoration got a new value each time something inside it changed, and React then rendered every `DecorationRoot` inside it: on React 19, a key typed in a section drawn by a React shape cost every paragraph in it.

A React shape that moves its content to another element while the editor updates (from the editor's state, or its node's) gets its content's tiles over the new elements. They stayed over the ones React removed, so the selection and coordinates inside it were wrong.

After a component threw while rendering, the next update draws the document again. It threw in turn ("must draw a DecorationRoot"), and the editor stayed broken. An error thrown when only the selection moved now comes out of the flush, as one thrown in any other update.

A reconfiguration giving a node wrapper to an atom directly in the document (a horizontal rule), or taking it away, no longer throws "React's DOM is missing a node".

A `DecorationRoot`, or a node given props by `NodeRootProps`, keeps Wordgard's own style when its component stops passing a `style`. On React 18 the properties the two shared were cleared: a centred paragraph lost its alignment.

## 0.2.2 (2026-11-07)

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
