// Named after react-prosemirror's useIgnoreMutation, rewritten for Wordgard:
// when `ignoreMutation` returns true for a DOM mutation inside the React
// decoration (its content included), Wordgard doesn't read it. Mutations in
// the decoration's chrome never reach Wordgard anyway (`sortRecords`). Typing
// isn't stopped: Wordgard takes it from `beforeinput`, not the mutation.
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

export const useIgnoreMutation = (
  ignoreMutation: (wg: Wordgard, mutation: MutationRecord) => boolean
) => {
  const { handlers } = useDecorationContext("useIgnoreMutation");
  const ignore = useEditorEventCallback(ignoreMutation);
  useLayoutEffect(() => {
    handlers.ignoreMutation.add(ignore);
    return () => {
      handlers.ignoreMutation.delete(ignore);
    };
  }, [handlers, ignore]);
};
