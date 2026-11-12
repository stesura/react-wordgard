// Adapted from react-wordgard's useIgnoreMutation (by way of vue-wordgard's) for Svelte. Chrome
// mutations are dropped before, by `sortRecords`.
import { onDestroy } from "svelte";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Wordgard doesn't read the DOM mutations `ignore` returns `true` for, typing aside (Wordgard takes
 * it from `beforeinput`). Mutations in chrome and Svelte widgets never reach Wordgard anyway.
 */
export const useIgnoreMutation = (ignore: (wg: Wordgard, mutation: MutationRecord) => boolean) => {
  const { handlers } = useDecorationContext("useIgnoreMutation");
  const { wg } = useEditorContext("useIgnoreMutation");
  const callback = (record: MutationRecord) => ignore(wg, record);
  handlers.ignoreMutation.add(callback);
  onDestroy(() => {
    handlers.ignoreMutation.delete(callback);
  });
};
