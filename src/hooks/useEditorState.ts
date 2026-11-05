// Named after react-prosemirror's useEditorState, rewritten for Wordgard.
import { useSyncExternalStore } from "react";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * The state as of the editor's last flush, rendered in the same React commit as the document. The
 * component re-renders on every flush: for a part of the state, use `useEditorStateSelector`; in a
 * handler, `wg.state` is the latest.
 */
export const useEditorState = () => {
  const { store } = useEditorContext();
  return useSyncExternalStore(store.subscribe, store.getState);
};
