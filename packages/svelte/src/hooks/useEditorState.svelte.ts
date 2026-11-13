// Adapted from react-wordgard's useEditorState (by way of vue-wordgard's) for Svelte: a value the
// editor's store sets inside its flush, where the component then commits, or after it outside the
// document (helpers/publish.ts). A selector is a `$derived` over it.
import { onDestroy } from "svelte";
import type { GardState } from "wordgard/state";

import { useEditorContext } from "../contexts/EditorContext.js";
import { onPublish } from "../helpers/publish.js";

/** The state as of the editor's last update (the one the DOM shows), in `current`. */
export const useEditorState = (): { readonly current: GardState } => {
  const editor = useEditorContext("useEditorState");
  const { store } = editor;
  let state = $state.raw(store.getState());
  onDestroy(
    store.subscribe(
      onPublish(editor, () => {
        state = store.getState();
      })
    )
  );
  return {
    get current() {
      return state;
    },
  };
};
