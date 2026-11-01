// Draws a React wrapper's component, with what it wraps (the node's shape, or
// the element its `target` picks) as its children. Like ShapeView, it has no
// effects: ReactDocTile builds the tiles over what it commits, and the
// component's own commits are sorted out of Wordgard's DOM observer.
import { type ReactNode, useMemo, useState } from "react";
import type { Node } from "wordgard/doc";

import { createWrapperHandle, nodePos, shapeAttributes } from "../decorations/ReactShapeType.js";
import { drawWrapper } from "../decorations/ReactWrapperType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../helpers/index.js";
import { mergeRefs } from "../helpers/refs.js";
import type { DecoElt } from "../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  node: Node;
  // Draws what's wrapped, its root's ref given.
  wrapped: (ref: (dom: Element | null) => void) => ReactNode;
  outerRef?: (dom: Element | null) => void;
};

export const WrapperView = ({ elt, node, wrapped, outerRef }: Props) => {
  const [{ handle, ref, wrappedRef }] = useState(createWrapperHandle);
  const [getPos] = useState(() => nodePos(handle));
  const rootRef = useMemo(() => mergeRefs(ref, outerRef), [ref, outerRef]);
  return drawWrapper(elt, {
    attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
    nodeProps: { node, getPos },
    children: wrapped(wrappedRef),
    ref: rootRef,
  });
};
