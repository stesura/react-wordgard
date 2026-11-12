// Adapted from react-wordgard's useStopEvent (by way of vue-wordgard's) for Svelte: consulted
// through widget types' `propagateEvent`, and through the decoration's own elements' tiles (the
// core's tile.ts, `ownTile`).
import { onDestroy } from "svelte";
import type { Wordgard } from "wordgard/editor";

import { useDecorationContext } from "../contexts/DecorationContext.js";
import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Asked for events in the decoration's chrome (its root and the elements around its content
 * element, unless the root is the content element) and in Svelte widgets; never for those in its
 * content. For an event it stops, Wordgard's handlers and keymaps are skipped and the browser's
 * default goes ahead.
 */
export const useStopEvent = (stopEvent: (wg: Wordgard, event: Event) => boolean) => {
  const { handlers } = useDecorationContext("useStopEvent");
  const { wg } = useEditorContext("useStopEvent");
  const stop = (event: Event) => stopEvent(wg, event);
  handlers.stopEvent.add(stop);
  onDestroy(() => {
    handlers.stopEvent.delete(stop);
  });
};
