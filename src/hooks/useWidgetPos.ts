// The position of the React widget a component is drawn in, read from its tile
// (`posBefore`): a node drawn as the widget is at its node's position. Returns
// a stable function, for event handlers and effects; during render the tile
// may not be built yet.
import { useContext } from "react";

import { WidgetContext } from "../contexts/WidgetContext.js";

export const useWidgetPos = () => {
  const handle = useContext(WidgetContext);
  if (!handle) throw new Error("useWidgetPos is called outside a React widget");
  return handle.pos;
};
