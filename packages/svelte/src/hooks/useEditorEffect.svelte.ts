// Adapted from react-wordgard's useEditorEffect (by way of vue-wordgard's) for Svelte: what
// `source` reads, tracked by an `$effect`, in place of React's dependencies.
import { untrack } from "svelte";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Runs `effect` once the editor's DOM is up to date: after the flush under way or pending, else in
 * a microtask. It may read layout and dispatch; what it sets shows a frame later. For focus,
 * follow-up dispatches and menus. It runs once mounted, then again whenever what `source` reads
 * changes, after the cleanup `effect` returned, which also runs on unmount. What `effect` reads
 * isn't tracked. Don't read the editor's layout from a component's script, template or `$effect`:
 * the update is refused there.
 */
export const useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  source?: () => unknown
) => {
  const { wg, afterFlush, cancel } = useEditorContext("useEditorEffect");
  let cleanup: void | (() => void);
  const run = () => {
    cleanup = untrack(() => effect(wg));
  };
  const clean = () => {
    cancel(run);
    if (typeof cleanup == "function") cleanup();
    cleanup = undefined;
  };
  $effect(() => {
    source?.();
    afterFlush(run);
    return clean;
  });
};
