## Unreleased

### New features

First release: svelte-wordgard draws Wordgard's document with its own DOM renderer, and any decoration that takes a shape, a wrapper or a widget, or a mark's shape, can be a Svelte 5 component.

`WordgardEditor` and `WordgardDoc` host the editor in a Svelte app, and unmounting `WordgardDoc` unmounts the document's components; the hooks (`useWordgard`, `useEditorState`, `useEditorField`, `useEditorFieldEntry`, `useEditorEffect`, `useEditorLayoutEffect`, `useEditorEventListener`) read and change it from components, those outside the document getting the state once the editor's update is done.

On the server (SvelteKit's first render), `WordgardEditor` creates no editor and draws nothing: its children are drawn in the browser, as the page hydrates.

`createShape`, `createWrapper`, `createMarkShape`, `createWidgetType` and `nodeWrapper` make Svelte components decorations, mounted with the contexts of the component whose `contentDOMRef` or `wrappedDOMRef` element holds them; `DecorationRoot` draws a root of the decoration's own tag, `WrappedNode` is a node wrapper's root, its attributes going on the node's root element, and `useNodePos`, `useIsNodeSelected`, `useSelectNode`, `useStopEvent` and `useIgnoreMutation` work inside them.
