// Adapted from react-wordgard's useNodePos (by way of vue-wordgard's) for Svelte.
import { useDecorationContext } from "../contexts/DecorationContext.js";

/**
 * A function giving the position of what the decoration draws, to call in event handlers or once
 * the editor's update is done: during the component's setup, its tiles don't exist yet.
 */
export const useNodePos = () => useDecorationContext("useNodePos").handlers.getPos;
