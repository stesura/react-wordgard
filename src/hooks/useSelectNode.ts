// Named after react-prosemirror's useSelectNode, rewritten for Wordgard:
// `selectNode` runs once the node the React decoration draws becomes the node
// selection, `deselectNode` once it stops being it, after the flush that draws
// the change, as ProseMirror's NodeView.selectNode and deselectNode.
import { useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorEffect } from "./useEditorEffect.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";
import { useIsNodeSelected } from "./useIsNodeSelected.js";

const noop = () => {};

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
