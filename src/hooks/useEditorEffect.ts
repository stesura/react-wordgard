// Named after react-prosemirror's useEditorEffect, rewritten for Wordgard.
import { type DependencyList, useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Runs `effect` once the editor's DOM is up to date: after the flush under way or pending, else in
 * a microtask, never inside React's commit. It may read layout and dispatch; what it sets shows a
 * frame later. For focus, follow-up dispatches and menus. The dependencies work as React's. Don't
 * read the editor's layout from a plain React effect: it can run inside Wordgard's update, before
 * the editor's view of the new DOM exists.
 */
export const useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  dependencies?: DependencyList
) => {
  const { wg, afterFlush, cancel } = useEditorContext();
  useLayoutEffect(
    () => {
      let cleanup: void | (() => void);
      const run = () => {
        cleanup = effect(wg);
      };
      afterFlush(run);
      return () => {
        cancel(run);
        if (typeof cleanup == "function") cleanup();
      };
      // The caller's dependencies, as with React's own effects, and the editor:
      // a WordgardScope can change it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    dependencies && [wg, ...dependencies]
  );
};
