// Named after react-prosemirror's useEditorEffect, rewritten for Wordgard: an
// effect that runs once the editor's DOM is up to date, after the flush under
// way or pending, else in a microtask, never inside React's commit, so it may
// read the editor's layout and dispatch. A plain React effect may run inside
// the flush, before the tiles over the new DOM exist.
import { type DependencyList, useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

export const useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  dependencies?: DependencyList
) => {
  const { wg, afterFlush, cancel } = useEditorContext();
  useLayoutEffect(() => {
    let cleanup: void | (() => void);
    const run = () => {
      cleanup = effect(wg);
    };
    afterFlush(run);
    return () => {
      cancel(run);
      if (typeof cleanup == "function") cleanup();
    };
    // The caller's dependencies, as with React's own effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};
