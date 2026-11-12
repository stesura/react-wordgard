// Named after react-prosemirror's useEditorEventListener, rewritten for Wordgard: ReactWordgard
// installs a `prec.highest` Wordgard.domEventHandler per type, first in an editor made from
// `config`, after the state's own in one made from a `state`. The latest registered runs first, as
// in react-prosemirror.
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";
import { type EditorEvent, listenersOf } from "@stesura/wordgard-view";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

/**
 * Listens to the editor's DOM events of `type`, before Wordgard's handlers and keymaps. Returning
 * `true` handles the event: Wordgard calls `preventDefault` and skips its own handling. The event
 * types are listed under [Limits](https://github.com/stesura/react-wordgard#limits). Key events
 * during a composition don't come; handling `input`, `beforeinput` or a composition event skips
 * Wordgard's own handling of it, so leave typing to Wordgard.
 */
export const useEditorEventListener = <Type extends EditorEvent>(
  type: Type,
  handler: (wg: Wordgard, event: HTMLElementEventMap[Type]) => boolean | void
) => {
  const { wg } = useEditorContext();
  const listener = useEditorEventCallback(handler);
  useLayoutEffect(() => {
    const listeners = listenersOf(wg, type);
    listeners.unshift(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, [wg, type, listener]);
};
