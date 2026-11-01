// Named after react-prosemirror's useEditorEventListener, rewritten for
// Wordgard: `handler` gets the editor's DOM events of `type` before Wordgard's
// own handlers and keymaps, as react-prosemirror's `handleDOMEvents` came
// before plugins: ReactWordgard installs a Wordgard.domEventHandler for each
// type, at the highest precedence. Returning true says it handled the event:
// Wordgard then calls `preventDefault` and goes no further. The latest
// registered runs first, as in react-prosemirror. Unlike there, key events
// during a composition don't come (Wordgard ignores them first), and handling
// `input`, `beforeinput` or a composition event skips Wordgard's own tracking
// of it. Among `prec.highest` handlers, these come first in an editor made
// from `config`, after the state's own in one made from a `state`.
import { useLayoutEffect } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";
import { type EditorEvent, listenersOf } from "../contexts/editorEvents.js";
import { useEditorEventCallback } from "./useEditorEventCallback.js";

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
