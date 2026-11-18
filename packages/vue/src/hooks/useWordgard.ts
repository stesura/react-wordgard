// Adapted from react-wordgard's useWordgard for Vue. Setup runs once: `useWordgard` gives the editor
// at setup, `useWordgardRef` one that follows a WordgardScope.
import { type ComputedRef, computed, isRef, warn, watch } from "vue";
import type { Wordgard } from "wordgard/editor";

import { currentEditor, useEditorSource } from "../contexts/EditorContext.js";

/**
 * The editor the component is drawn in, or its `WordgardScope` gives, as it is in setup. Under a
 * scope whose editor changes, use `useWordgardRef`: in development, a change warns.
 */
export const useWordgard = () => {
  const source = useEditorSource("useWordgard");
  // Vue's `warn` does nothing in production builds.
  if (isRef(source))
    watch(
      source,
      () =>
        warn(
          "The WordgardScope's editor changed, but a component under it took the first with useWordgard(): use useWordgardRef() to follow it"
        ),
      { flush: "sync", once: true }
    );
  return currentEditor(source).wg;
};

/** A ref of the editor the component is drawn in, which follows its `WordgardScope`'s. */
export const useWordgardRef = (): Readonly<ComputedRef<Wordgard>> => {
  const source = useEditorSource("useWordgardRef");
  return computed(() => currentEditor(source).wg);
};
