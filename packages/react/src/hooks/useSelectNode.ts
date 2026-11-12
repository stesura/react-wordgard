// Named after react-prosemirror's useSelectNode, rewritten for Wordgard.
import { useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorEffect } from "./useEditorEffect.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";
import { useIsNodeSelected } from "./useIsNodeSelected.js";

const noop = () => {};

/**
 * Calls `selectNode` when the node becomes the node selection, and `deselectNode` when it stops
 * being it, once the editor's DOM is up to date (as `useEditorEffect`).
 */
export const useSelectNode = (
  selectNode: (wg: Wordgard) => void,
  deselectNode: (wg: Wordgard) => void = noop
) => {
  const selected = useIsNodeSelected();
  const select = useEditorEventCallback(selectNode);
  const deselect = useEditorEventCallback(deselectNode);
  const was = useRef(false);
  useEditorEffect(() => {
    if (selected == was.current) return;
    was.current = selected;
    if (selected) select();
    else deselect();
  }, [selected, select, deselect]);
};
