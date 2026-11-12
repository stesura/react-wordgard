## Unreleased

### New features

First release: svelte-wordgard draws Wordgard's document with its own DOM renderer, and any decoration that takes a shape, a wrapper or a widget, or a mark's shape, can be a Svelte 5 component.

`createShape`, `createWrapper`, `createMarkShape` and `createWidgetType` make Svelte components decorations, mounted with the contexts of the component whose `contentDOMRef` or `wrappedDOMRef` element holds them; `DecorationRoot` draws a root of the decoration's own tag, and `useNodePos`, `useIsNodeSelected`, `useSelectNode`, `useStopEvent`, `useIgnoreMutation` and `useWordgard` work inside them.
