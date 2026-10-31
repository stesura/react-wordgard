// Named after react-prosemirror's useEditorState, rewritten for Wordgard: the
// state the editor's DOM shows, as of its last flush. Re-renders on every
// state change, in the same commit as the document; `wg.state` is ahead of it
// between a dispatch and the flush.
import { useSyncExternalStore } from "react";

import { useEditorContext } from "../contexts/EditorContext.js";

export const useEditorState = () => {
  const { store } = useEditorContext();
  return useSyncExternalStore(store.subscribe, store.getState);
};
