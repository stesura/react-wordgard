## 0.4.5 (2026-11-23)

No changes of its own: released with the other packages.

## 0.4.4 (2026-11-21)

### Bug fixes

A widget leaving the start of a block, in the update where that block's own decorations change (a point attribute on it), is no longer drawn twice: the block kept its last layout, the widget included. Seen as a collaborator's caret left behind at the start of the paragraph being typed in.

## 0.4.3 (2026-11-20)

No changes of its own: released with the other packages.

## 0.4.2 (2026-11-20)

### Bug fixes

An editor drawn inside another editor's shape (a sub-editor in an atom's chrome) keeps the user's typing: the outer editor's shape no longer claims the inner editor's DOM changes, which left typed text doubled or threw.

## 0.4.1 (2026-11-19)

### Bug fixes

The published package no longer declares a source export condition pointing at files it doesn't ship.

## 0.4.0 (2026-11-19)

### New features

First release: svelte-wordgard draws Wordgard's document with its own DOM renderer, and any decoration that takes a shape, a wrapper or a widget, or a mark's shape, can be a Svelte 5 component.

`WordgardEditor` and `WordgardDoc` host the editor in a Svelte app, and unmounting `WordgardDoc` unmounts the document's components; the hooks (`useWordgard`, `useEditorState`, `useEditorField`, `useEditorFieldEntry`, `useEditorEffect`, `useEditorLayoutEffect`, `useEditorEventListener`) read and change it from components, those outside the document getting the state once the editor's update is done.

On the server (SvelteKit's first render), `WordgardEditor` creates no editor and draws nothing: its children are drawn in the browser, as the page hydrates.

`createShape`, `createWrapper`, `createMarkShape`, `createWidgetType` and `nodeWrapper` make Svelte components decorations, mounted with the contexts of the component whose `contentDOMRef` or `wrappedDOMRef` element holds them; `DecorationRoot` draws a root of the decoration's own tag, `WrappedNode` is a node wrapper's root, its attributes going on the node's root element, and `useNodePos`, `useIsNodeSelected`, `useSelectNode`, `useStopEvent` and `useIgnoreMutation` work inside them.
