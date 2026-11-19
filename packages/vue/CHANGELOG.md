## 0.4.0 (2026-11-19)

### New features

First release: vue-wordgard draws Wordgard's document with Vue 3.5, in the app's tree, and any decoration that takes a shape, a wrapper or a widget, or a mark's shape, can be a Vue component.

`WordgardEditor` and `WordgardDoc` host the editor in a Vue app; the composables (`useWordgard`, `useEditorState`, `useEditorField`, `useEditorFieldEntry`, `useEditorEffect`, `useEditorLayoutEffect`, `useEditorEventListener`) read and change it from components.

`createShape`, `createWrapper`, `createMarkShape`, `createWidgetType` and `nodeWrapper` make Vue components decorations; `DecorationRoot`, `NodeContent` and `WrappedNode` draw their root, their content and what they wrap, and `useNodePos`, `useIsNodeSelected`, `useSelectNode`, `useStopEvent` and `useIgnoreMutation` work inside them.

`WordgardScope` gives the components in its slot an editor made elsewhere, and the composables under it follow when it changes; `useWordgardRef` is the editor as a ref that follows it.

`WordgardEditor` works in a page rendered on the server: there, and while the page hydrates, it creates no editor and draws nothing, and its slot appears once the page has mounted.

`useMergedDOMRefs`, `staticCopy` and `isTrailingBreak` work as in react-wordgard.
