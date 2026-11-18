// Adapted from react-wordgard's useEditorState for Vue: a shallowRef the editor's store sets inside
// its flush, where the component then commits (sync.ts), or after it outside the document. A
// selector is a `computed` over it.
import { type ShallowRef, shallowRef } from "vue";
import type { GardState } from "wordgard/state";

import { currentEditor, followEditor, useEditorSource } from "../contexts/EditorContext.js";
import { publisher, updateInFlush } from "../sync.js";

/**
 * The state as of the editor's last update (the one the DOM shows). Under a `WordgardScope`, its
 * editor's, switching with it.
 */
export const useEditorState = (): Readonly<ShallowRef<GardState>> => {
  const source = useEditorSource("useEditorState");
  const subscribe = publisher();
  const state = shallowRef(currentEditor(source).store.getState());
  followEditor(source, (editor) => {
    const { store } = editor;
    state.value = store.getState();
    return subscribe(editor, store.subscribe, () => {
      state.value = store.getState();
    });
  });
  updateInFlush();
  return state;
};
