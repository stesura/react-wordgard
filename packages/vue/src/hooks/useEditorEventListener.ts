// Adapted from react-wordgard's useEditorEventListener for Vue: RenderedWordgard installs a
// `prec.highest` Wordgard.domEventHandler per type. The latest registered runs first.
import type { Wordgard } from "wordgard/editor";

import { type EditorEvent, listenersOf } from "@stesura/wordgard-view";
import { followEditor, useEditorSource } from "../contexts/EditorContext.js";

/**
 * Listens to the editor's DOM events of `type`, before Wordgard's handlers and keymaps, while the
 * component is mounted. Returning `true` handles the event: Wordgard calls `preventDefault` and
 * skips its own handling. Key events during a composition don't come; handling `input`,
 * `beforeinput` or a composition event skips Wordgard's own handling of it, so leave typing to
 * Wordgard. Under a `WordgardScope`, it moves to the editor the scope gives.
 */
export const useEditorEventListener = <Type extends EditorEvent>(
  type: Type,
  handler: (wg: Wordgard, event: HTMLElementEventMap[Type]) => boolean | void
) =>
  followEditor(
    useEditorSource("useEditorEventListener"),
    ({ wg }) => {
      const listener = (event: HTMLElementEventMap[Type]) => handler(wg, event);
      listenersOf(wg, type).unshift(listener);
      return () => {
        const listeners = listenersOf(wg, type);
        const at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      };
    },
    true
  );
