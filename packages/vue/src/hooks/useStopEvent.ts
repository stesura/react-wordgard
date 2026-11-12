// Adapted from react-wordgard's useStopEvent for Vue: consulted through widget types'
// `propagateEvent`, and through the decoration's own elements' tiles (the core's tile.ts,
// `ownTile`).
import { onUnmounted } from "vue";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";
import { useDecorationContext } from "../contexts/DecorationContext.js";

/**
 * Asked for events in the decoration's chrome (its root and the elements around its content
 * element, unless the root is the content element) and in Vue widgets; never for those in its
 * content. For an event it stops, Wordgard's handlers and keymaps are skipped and the browser's
 * default goes ahead.
 */
export const useStopEvent = (stopEvent: (wg: Wordgard, event: Event) => boolean) => {
  const { handlers } = useDecorationContext("useStopEvent");
  const { wg } = useEditorContext("useStopEvent");
  const stop = (event: Event) => stopEvent(wg, event);
  handlers.stopEvent.add(stop);
  onUnmounted(() => {
    handlers.stopEvent.delete(stop);
  });
};
