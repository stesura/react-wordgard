// Named after react-prosemirror's useIgnoreMutation, rewritten for Wordgard. Chrome mutations are
// dropped before, by `sortRecords`.
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

/**
 * Wordgard doesn't read the DOM mutations `ignore` returns `true` for, typing aside (Wordgard takes
 * it from `beforeinput`). Mutations in chrome and React widgets never reach Wordgard anyway.
 */
export const useIgnoreMutation = (ignore: (wg: Wordgard, mutation: MutationRecord) => boolean) => {
  const { handlers } = useDecorationContext("useIgnoreMutation");
  const callback = useEditorEventCallback(ignore);
  useLayoutEffect(() => {
    handlers.ignoreMutation.add(callback);
    return () => {
      handlers.ignoreMutation.delete(callback);
    };
  }, [handlers, callback]);
};
