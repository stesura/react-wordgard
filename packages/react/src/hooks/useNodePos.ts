// Named after react-prosemirror's useNodePos, rewritten for Wordgard: read from the decoration's
// tile. A function rather than the position: during render, the tile may not be built yet.
import { useDecorationContext } from "../contexts/DecorationContext.js";

/**
 * A function giving the position of what the decoration draws, to call in handlers and effects.
 */
export const useNodePos = () => useDecorationContext("useNodePos").handlers.getPos;
