// Named after react-prosemirror's ReactNodeView, for Wordgard: draws a React
// shape's component, with the node's content as its children. ReactDocTile
// builds the tiles over what it commits; the component's own commits are
// sorted out of Wordgard's DOM observer (`sortRecords`).
import { type ReactNode, useState } from "react";
import type { Node } from "wordgard/doc";

import { createShapeHandle, drawShape, shapeAttributes } from "../decorations/ReactShapeType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../helpers/index.js";
import type { DecoElt } from "../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  node: Node;
  content: ReactNode;
};

export const ShapeView = ({ elt, node, content }: Props) => {
  const [{ handle, ref, contentDOMRef }] = useState(createShapeHandle);
  const [getPos] = useState(() => () => {
    // The node's tile: the root's, or the one around it when wrapped.
    let tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
    while (tile && !tile.tag) tile = tile.parent ?? undefined;
    if (!tile) throw new Error("This React shape isn't drawn");
    return tile.posBefore;
  });
  return drawShape(elt, {
    attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
    nodeProps: { node, getPos, contentDOMRef },
    children: content,
    ref,
  });
};
