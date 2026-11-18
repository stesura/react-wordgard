// Adapted from react-wordgard's WordgardScope for Vue: it provides a ref of the editor, which the
// composables under it follow (EditorContext.ts's `followEditor`), setup running once.
import { defineComponent, provide, shallowRef, watch } from "vue";
import type { Wordgard } from "wordgard/editor";

import { findEditor } from "@stesura/wordgard-view";
import { EditorKey } from "../contexts/EditorContext.js";

const editorOf = (wg: Wordgard) => {
  const editor = findEditor(wg);
  if (!editor) throw new Error("WordgardScope takes an editor a WordgardEditor made");
  return editor;
};

/**
 * Gives the components in its slot `wg`, an editor a `WordgardEditor` made elsewhere, in place of
 * the one around them: for a toolbar acting on whichever of a page's editors has focus. It draws no
 * element. The composables under it follow when `wg` changes: states and fields switch to the new
 * editor's, effects run again, listeners and layout effects move. `useWordgard()` gives the editor
 * as it was in setup; `useWordgardRef()` follows. Any other editor throws.
 */
export const WordgardScope = defineComponent(
  (props: { wg: Wordgard }, { slots }) => {
    const editor = shallowRef(editorOf(props.wg));
    // Synchronous, as the composables' own watchers: they switch before the slot renders.
    watch(
      () => props.wg,
      (wg) => {
        const found = findEditor(wg);
        if (found) editor.value = found;
      },
      { flush: "sync" }
    );
    provide(EditorKey, editor);
    // Refused in render, as React's: a production build logs a watcher's error and goes on,
    // where a render's leaves the slot empty instead of on the last editor.
    return () => {
      editorOf(props.wg);
      return slots.default?.();
    };
  },
  { props: ["wg"] }
);
