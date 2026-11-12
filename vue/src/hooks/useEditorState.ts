// Adapted from react-wordgard's useEditorState for Vue: a shallowRef the editor's store sets inside
// its flush, where the component then commits (sync.ts). A selector is a `computed` over it.
import { type ShallowRef, onUnmounted, shallowRef } from "vue";
import type { GardState } from "wordgard/state";

import { useEditorContext } from "../contexts/EditorContext.js";
import { updateInFlush } from "../sync.js";

/** The state as of the editor's last update (the one the DOM shows). */
export const useEditorState = (): Readonly<ShallowRef<GardState>> => {
  const { store } = useEditorContext("useEditorState");
  const state = shallowRef(store.getState());
  onUnmounted(
    store.subscribe(() => {
      state.value = store.getState();
    })
  );
  updateInFlush();
  return state;
};
