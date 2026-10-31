// Named after react-prosemirror's useEditorEventCallback, rewritten for
// Wordgard: a stable function calling the latest `callback` with the editor,
// for event handlers.
import { useCallback, useLayoutEffect, useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

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
