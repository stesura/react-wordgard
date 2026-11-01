// Named after react-prosemirror's useEditorStateSelector, rewritten for
// Wordgard: a piece of the state useEditorState gives, re-rendering only when
// it changes, by `Object.is` or by `isEqual`. React's own selector store keeps
// the result for a state, so a selector may build an object or an array.
import type { GardState } from "wordgard/state";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { useEditorContext } from "../contexts/EditorContext.js";

export const useEditorStateSelector = <Result>(
  selector: (state: GardState) => Result,
  isEqual?: (a: Result, b: Result) => boolean
): Result => {
  const { store } = useEditorContext();
  return useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getState,
    store.getState,
    selector,
    isEqual
  );
};
