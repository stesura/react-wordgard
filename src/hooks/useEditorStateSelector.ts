// Named after react-prosemirror's useEditorStateSelector, rewritten for
// Wordgard: a piece of the state useEditorState gives, re-rendering only when
// it changes (by `Object.is`, so the selector should return the same value for
// the same state).
import { useSyncExternalStore } from "react";
import type { GardState } from "wordgard/state";

import { useEditorContext } from "../contexts/EditorContext.js";

export const useEditorStateSelector = <Result>(selector: (state: GardState) => Result): Result => {
  const { store } = useEditorContext();
  const select = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, select);
};
