// Adapted from react-wordgard's demo (demo/useFloatingAt.ts, by way of vue-wordgard's) for Svelte.
import { useEditorEffect } from "@stesura/svelte-wordgard";

export type Coords = { left: number; top: number; bottom: number };

// Where a position is on the page, for a menu in the body. Read after the
// editor's update, as layout must be.
export const useFloatingAt = (pos: () => number | null): { readonly current: Coords | null } => {
  let coords = $state.raw<Coords | null>(null);
  useEditorEffect(
    (wg) => {
      const at = pos();
      if (at == null) {
        coords = null;
        return;
      }
      const { left, top, bottom } = wg.coordsAtPos(at, 1);
      coords = { left: left + scrollX, top: top + scrollY, bottom: bottom + scrollY };
    },
    () => pos()
  );
  return {
    get current() {
      return coords;
    },
  };
};
