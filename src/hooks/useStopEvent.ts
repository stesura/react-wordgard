// Named after react-prosemirror's useStopEvent, rewritten for Wordgard: when
// `stopEvent` returns true, Wordgard doesn't handle the event, nor do its
// handlers and keymaps, and the browser's default goes ahead. It's consulted
// through widget types' `propagateEvent`: for events in a React decoration's
// chrome or in a React widget, its own or a nested one's, not for those on
// its own elements or in plain content.
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

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
