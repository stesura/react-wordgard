// Named after react-prosemirror's useEditorStateSelector, rewritten for Wordgard.
import type { GardState } from "wordgard/state";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * A part of the last flush's state, like Redux's `useSelector`: the component re-renders only when
 * the result changes, by `Object.is` or by `isEqual`. A selector building a new object or array
 * each time re-renders on every flush unless you pass `isEqual`.
 */
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
