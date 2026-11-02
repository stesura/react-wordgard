// Named after react-prosemirror's ReactNodeView, for Wordgard: draws a React
// shape's component, with the node's content as its children. ReactDocTile
// builds the tiles over what it commits; the component's own commits are
// sorted out of Wordgard's DOM observer (`sortRecords`).
import React, { type ReactNode, useMemo, useState } from "react";
import type { Node } from "wordgard/doc";

import {
  DecorationContext,
  createDecorationHandlers,
  decorationRoot,
} from "../contexts/DecorationContext.js";
import {
  atomRef,
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
  selected: boolean;
  // Also given the root: a React wrapper's, when this shape is what it wraps.
  outerRef?: ((dom: Element | null) => void) | undefined;
};

export const ShapeView = ({ elt, node, content, selected, outerRef }: Props) => {
  const [{ handle, ref, contentDOMRef }] = useState(createShapeHandle);
  const [handlers] = useState(() => createDecorationHandlers(nodePos(handle)));
  const atom = !elt.hasContent;
  const rootRef = useMemo(
    () => mergeRefs(ref, outerRef, decorationRoot(handlers), atomRef(handle, atom)),
    [ref, outerRef, handlers, handle, atom]
  );
  const decoration = useMemo(() => ({ handlers, selected }), [handlers, selected]);
  return (
    <DecorationContext.Provider value={decoration}>
      {drawShape(elt, {
        attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
        nodeProps: { node, getPos: handlers.getPos, contentDOMRef },
        children: content,
        ref: rootRef,
      })}
    </DecorationContext.Provider>
  );
};
