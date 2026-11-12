// Adapted from react-wordgard's demo (demo/useFloatingAt.ts) for Vue.
import { type Ref, shallowRef } from "vue";

import { useEditorEffect } from "../src/index.js";

export type Coords = { left: number; top: number; bottom: number };

// Where a position is on the page, for a menu teleported to the body. Read
// after the editor's update, as layout must be.
export const useFloatingAt = (pos: Readonly<Ref<number | null>>) => {
  const coords = shallowRef<Coords | null>(null);
  useEditorEffect((wg) => {
    if (pos.value == null) {
      coords.value = null;
      return;
    }
    const { left, top, bottom } = wg.coordsAtPos(pos.value, 1);
    coords.value = { left: left + scrollX, top: top + scrollY, bottom: bottom + scrollY };
  }, pos);
  return coords;
};
