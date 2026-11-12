// Adapted from react-wordgard's useSelectNode (by way of vue-wordgard's) for Svelte.
import { onDestroy } from "svelte";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";
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
  const editor = useEditorContext("useSelectNode");
  let was = false;
  const run = () => {
    if (selected.current == was) return;
    was = selected.current;
    if (was) selectNode(editor.wg);
    else deselectNode(editor.wg);
  };
  $effect.pre(() => {
    void selected.current;
    editor.afterFlush(run);
  });
  onDestroy(() => editor.cancel(run));
};
