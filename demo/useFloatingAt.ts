import { useState } from "react";

import { useEditorEffect } from "@stesura/react-wordgard";

export type Coords = { left: number; top: number; bottom: number };

// Where a position is on the page, for a menu portaled to the body. Read
// after the editor's update, as layout must be.
export const useFloatingAt = (pos: number | null) => {
  const [coords, setCoords] = useState<Coords | null>(null);
  useEditorEffect(
    (wg) => {
      if (pos == null) {
        setCoords(null);
        return;
      }
      const { left, top, bottom } = wg.coordsAtPos(pos, 1);
      setCoords({ left: left + scrollX, top: top + scrollY, bottom: bottom + scrollY });
    },
    [pos]
  );
  return pos == null ? null : coords;
};
