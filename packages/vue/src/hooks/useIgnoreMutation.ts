// Adapted from react-wordgard's useIgnoreMutation for Vue. Chrome mutations are dropped before, by
// `sortRecords`.
import { onUnmounted } from "vue";
import type { Wordgard } from "wordgard/editor";

import { currentEditor, useEditorSource } from "../contexts/EditorContext.js";
import { useDecorationContext } from "../contexts/DecorationContext.js";

/**
 * Wordgard doesn't read the DOM mutations `ignore` returns `true` for, typing aside (Wordgard takes
 * it from `beforeinput`). Mutations in chrome and Vue widgets never reach Wordgard anyway.
 */
export const useIgnoreMutation = (ignore: (wg: Wordgard, mutation: MutationRecord) => boolean) => {
  const { handlers } = useDecorationContext("useIgnoreMutation");
  const source = useEditorSource("useIgnoreMutation");
  const callback = (record: MutationRecord) => ignore(currentEditor(source).wg, record);
  handlers.ignoreMutation.add(callback);
  onUnmounted(() => {
    handlers.ignoreMutation.delete(callback);
  });
};
