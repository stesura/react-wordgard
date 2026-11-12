// Named after react-prosemirror's useIsNodeSelected, rewritten for Wordgard: read from the
// `wg-selected-node` class Wordgard draws, so the component renders with it, without an effect.
import { useDecorationContext } from "../contexts/DecorationContext.js";

/** Whether the node the decoration draws is the editor's node selection. */
export const useIsNodeSelected = () => useDecorationContext("useIsNodeSelected").selected;
