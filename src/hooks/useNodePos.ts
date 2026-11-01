// Named after react-prosemirror's useNodePos, rewritten for Wordgard: the
// position of what the React decoration a component is drawn in draws (a
// shape's, wrapper's or widget's node, or where a mark or point widget
// starts), read from its tile. Returns a stable function, for event handlers
// and effects, rather than the position: during render the tile may not be
// built yet.
import { useDecorationContext } from "../contexts/DecorationContext.js";

export const useNodePos = () => useDecorationContext("useNodePos").handlers.getPos;
