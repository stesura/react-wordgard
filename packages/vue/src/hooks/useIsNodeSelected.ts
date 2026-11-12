// Adapted from react-wordgard's useIsNodeSelected for Vue: read from the `wg-selected-node` class
// Wordgard draws.
import { useDecorationContext } from "../contexts/DecorationContext.js";
import { updateInFlush } from "../sync.js";

/** Whether the node the decoration draws is the editor's node selection. */
export const useIsNodeSelected = () => {
  const { selected } = useDecorationContext("useIsNodeSelected");
  updateInFlush();
  return selected;
};
