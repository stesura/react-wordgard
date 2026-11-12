// Adapted from react-wordgard's useNodePos for Vue.
import { useDecorationContext } from "../contexts/DecorationContext.js";

/**
 * A function giving the position of what the decoration draws, to call in event handlers or once
 * the editor's update is done: `onMounted` runs inside it, before the tiles exist, and throws.
 */
export const useNodePos = () => useDecorationContext("useNodePos").handlers.getPos;
