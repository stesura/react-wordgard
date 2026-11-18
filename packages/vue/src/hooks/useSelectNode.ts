// Adapted from react-wordgard's useSelectNode for Vue.
import { onUnmounted, watch } from "vue";
import type { Wordgard } from "wordgard/editor";

import type { EditorValue } from "@stesura/wordgard-view";
import { currentEditor, useEditorSource } from "../contexts/EditorContext.js";
import { useIsNodeSelected } from "./useIsNodeSelected.js";

const noop = () => {};

/**
 * Calls `selectNode` when the node becomes the node selection, and `deselectNode` when it stops
 * being it, once the editor's DOM is up to date.
 */
export const useSelectNode = (
  selectNode: (wg: Wordgard) => void,
  deselectNode: (wg: Wordgard) => void = noop
) => {
  const selected = useIsNodeSelected();
  const source = useEditorSource("useSelectNode");
  // The editor `run` is scheduled on.
  let editor: EditorValue | null = null;
  let was = false;
  const run = () => {
    if (selected.value == was) return;
    was = selected.value;
    const { wg } = currentEditor(source);
    if (was) selectNode(wg);
    else deselectNode(wg);
  };
  watch(
    selected,
    () => {
      editor?.cancel(run);
      editor = currentEditor(source);
      editor.afterFlush(run);
    },
    { immediate: true, flush: "sync" }
  );
  onUnmounted(() => editor?.cancel(run));
};
