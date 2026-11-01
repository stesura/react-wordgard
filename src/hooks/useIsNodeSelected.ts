// Named after react-prosemirror's useIsNodeSelected, rewritten for Wordgard:
// whether the node the React decoration a component is drawn in draws is the
// node selection, read from the class Wordgard draws it with
// (`wg-selected-node`), so the component renders with it, without an effect.
import { useDecorationContext } from "../contexts/DecorationContext.js";

export const useIsNodeSelected = () => useDecorationContext("useIsNodeSelected").selected;
