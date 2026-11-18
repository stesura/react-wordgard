// Adapted from react-wordgard's useEditorEffect for Vue: a `watch` source in place of React's
// dependencies, and a WordgardScope's editor among them, as React's hook adds the editor.
import { type WatchSource, isRef, onMounted, onUnmounted, watch } from "vue";
import type { Wordgard } from "wordgard/editor";

import type { EditorValue } from "@stesura/wordgard-view";
import { currentEditor, useEditorSource } from "../contexts/EditorContext.js";

/**
 * Runs `effect` once the editor's DOM is up to date: after the flush under way or pending, else in
 * a microtask. It may read layout and dispatch; what it sets shows a frame later. For focus,
 * follow-up dispatches and menus. It runs once mounted, then again whenever `source` (what `watch`
 * takes: a ref, a getter, or an array of them) or a `WordgardScope`'s editor changes, after the
 * cleanup `effect` returned, which also runs on unmount. Don't read the editor's layout from a
 * component's setup, render or hooks (`onMounted`): the update is refused there.
 */
export const useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  source?: WatchSource | WatchSource[]
) => {
  const editorSource = useEditorSource("useEditorEffect");
  // The editor `run` is scheduled on.
  let editor: EditorValue | null = null;
  let cleanup: void | (() => void);
  const run = () => {
    if (editor) cleanup = effect(editor.wg);
  };
  const clean = () => {
    editor?.cancel(run);
    if (typeof cleanup == "function") cleanup();
    cleanup = undefined;
  };
  const schedule = () => {
    clean();
    editor = currentEditor(editorSource);
    editor.afterFlush(run);
  };
  onMounted(schedule);
  const sources = [
    ...(isRef(editorSource) ? [editorSource] : []),
    ...(Array.isArray(source) ? source : source ? [source] : []),
  ];
  if (sources.length) watch(sources, schedule, { flush: "post" });
  onUnmounted(clean);
};
