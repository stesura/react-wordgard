// Adapted from react-wordgard's useEditorEffect for Vue: a `watch` source in place of React's
// dependencies.
import { type WatchSource, onMounted, onUnmounted, watch } from "vue";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Runs `effect` once the editor's DOM is up to date: after the flush under way or pending, else in
 * a microtask. It may read layout and dispatch; what it sets shows a frame later. For focus,
 * follow-up dispatches and menus. It runs once mounted, then again whenever `source` (what `watch`
 * takes: a ref, a getter, or an array of them) changes, after the cleanup `effect` returned, which
 * also runs on unmount. Don't read the editor's layout from a component's setup, render or hooks
 * (`onMounted`): the update is refused there.
 */
export const useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  source?: WatchSource | WatchSource[]
) => {
  const { wg, afterFlush, cancel } = useEditorContext("useEditorEffect");
  let cleanup: void | (() => void);
  const run = () => {
    cleanup = effect(wg);
  };
  const clean = () => {
    cancel(run);
    if (typeof cleanup == "function") cleanup();
    cleanup = undefined;
  };
  const schedule = () => {
    clean();
    afterFlush(run);
  };
  onMounted(schedule);
  if (Array.isArray(source)) watch(source, schedule, { flush: "post" });
  else if (source) watch(source, schedule, { flush: "post" });
  onUnmounted(clean);
};
