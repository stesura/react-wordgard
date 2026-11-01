// Named after react-prosemirror's ReactNodeView, for Wordgard: draws a React
// shape's component, with the node's content as its children. ReactDocTile
// builds the tiles over what it commits; the component's own commits are
// sorted out of Wordgard's DOM observer (`sortRecords`).
import { type ReactNode, useMemo, useState } from "react";
import type { Node } from "wordgard/doc";

import {
  createShapeHandle,
  drawShape,
  nodePos,
  shapeAttributes,
} from "../decorations/ReactShapeType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../helpers/index.js";
import { mergeRefs } from "../helpers/refs.js";
import type { DecoElt } from "../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  node: Node;
  content: ReactNode;
  // Also given the root: a React wrapper's, when this shape is what it wraps.
  outerRef?: (dom: Element | null) => void;
};

export const ShapeView = ({ elt, node, content, outerRef }: Props) => {
  const [{ handle, ref, contentDOMRef }] = useState(createShapeHandle);
  const [getPos] = useState(() => nodePos(handle));
  const rootRef = useMemo(() => mergeRefs(ref, outerRef), [ref, outerRef]);
  return drawShape(elt, {
    attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
    nodeProps: { node, getPos, contentDOMRef },
    children: content,
    ref: rootRef,
  });
};
