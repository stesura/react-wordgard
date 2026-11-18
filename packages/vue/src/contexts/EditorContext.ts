// Adapted from react-wordgard's EditorContext.ts for Vue: the editor, provided through the app
// context VueDocTile gives the document's components (the core's editorStore.ts has the store).
// Also the node wrappers of the state the document is drawn from (NodeWrapperContext in
// react-wordgard). Setup runs once, so a WordgardScope provides a ref its composables follow,
// where React renders them again with a new context value.
import {
  type Component,
  type InjectionKey,
  type ShallowRef,
  inject,
  isRef,
  onBeforeMount,
  onUnmounted,
  watch,
} from "vue";

import type { EditorValue, NodeWrappers } from "@stesura/wordgard-view";

// A WordgardEditor's or a document's editor, or a WordgardScope's, which may change.
export type EditorSource = EditorValue | Readonly<ShallowRef<EditorValue>>;

export const EditorKey: InjectionKey<EditorSource> = Symbol("editor");

export const NodeWrappersKey: InjectionKey<ShallowRef<NodeWrappers<Component>>> =
  Symbol("nodeWrappers");

export const useEditorSource = (composable: string) => {
  const source = inject(EditorKey, null);
  if (!source) throw new Error(`${composable} is used outside a Wordgard editor`);
  return source;
};

export const currentEditor = (source: EditorSource) => (isRef(source) ? source.value : source);

/** The editor the calling component is under, as it is in its setup. */
export const useEditorContext = (composable: string) => currentEditor(useEditorSource(composable));

/**
 * Calls `attach` with the editor `source` gives, in setup (or before mounting, with `onMount`), and
 * again with each editor a WordgardScope gives next, after running what the last call returned,
 * which also runs on unmount.
 */
export const followEditor = (
  source: EditorSource,
  attach: (editor: EditorValue) => () => void,
  onMount = false
) => {
  let detach: (() => void) | null = null;
  const start = () => {
    detach = attach(currentEditor(source));
  };
  if (onMount) onBeforeMount(start);
  else start();
  // Synchronous: what the composable gives switches before anything renders with the new editor,
  // where a `pre` watcher could run after flushUpdates rendered the component.
  if (isRef(source))
    watch(
      source,
      (editor) => {
        if (!detach) return;
        detach();
        detach = attach(editor);
      },
      { flush: "sync" }
    );
  onUnmounted(() => {
    detach?.();
    detach = null;
  });
};
