// Named after react-prosemirror's useStopEvent, rewritten for Wordgard: consulted through widget
// types' `propagateEvent`, and through the decoration's own elements' tiles (tile.ts `ownTile`).
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

/**
 * Asked for events in the decoration's chrome (its root and the elements around its content
 * element, unless the root is the content element) and in React widgets; never for those in its
 * content. For an event it stops, Wordgard's handlers and keymaps are skipped and the browser's
 * default goes ahead: for a control in the chrome, such as an input.
 */
export const useStopEvent = (stopEvent: (wg: Wordgard, event: Event) => boolean) => {
  const { handlers } = useDecorationContext("useStopEvent");
  const stop = useEditorEventCallback(stopEvent);
  useLayoutEffect(() => {
    handlers.stopEvent.add(stop);
    return () => {
      handlers.stopEvent.delete(stop);
    };
  }, [handlers, stop]);
};
