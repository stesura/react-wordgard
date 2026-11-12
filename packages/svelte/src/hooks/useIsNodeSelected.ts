// Adapted from react-wordgard's useIsNodeSelected (by way of vue-wordgard's) for Svelte: read from
// the `wg-selected-node` class Wordgard draws.
import { useDecorationContext } from "../contexts/DecorationContext.js";

/** Whether the node the decoration draws is the editor's node selection, in `current`. */
export const useIsNodeSelected = (): { readonly current: boolean } =>
  useDecorationContext("useIsNodeSelected").selected;
