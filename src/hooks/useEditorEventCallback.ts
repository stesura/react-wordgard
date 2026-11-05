// Named after react-prosemirror's useEditorEventCallback, rewritten for Wordgard.
import { useCallback, useLayoutEffect, useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * A stable function calling the latest `callback` with the editor first, for event handlers. There,
 * `wg.state` is the latest state, dispatches not yet drawn included. See the `SaveButton` in
 * [Accessing the state outside the
 * editor](https://github.com/stesura/react-wordgard#accessing-the-state-outside-the-editor).
 */
export const useEditorEventCallback = <Args extends unknown[], Result>(
  callback: (wg: Wordgard, ...args: Args) => Result
) => {
  const { wg } = useEditorContext();
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: Args) => latest.current(wg, ...args), [wg]);
};
