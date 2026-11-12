// Not in react-prosemirror: the node wrappers of the state the document is drawn from. Its value
// changes only with a reconfiguration, which then lays the document out and builds it again
// (ReactDocTile.updateRanges).
import { createContext } from "react";

import type { NodeWrappers } from "../decorations/ReactNodeWrapper.js";
import { createNodeWrappers } from "../decorations/nodeWrapperType.js";

export const NodeWrapperContext = createContext<NodeWrappers>(createNodeWrappers([]));
