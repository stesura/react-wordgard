// Named after react-prosemirror's ReactNodeView, for Wordgard: draws a React shape's component. Its
// own commits are sorted out of Wordgard's DOM observer (`sortRecords`).
import React, { type ReactNode, useMemo, useState } from "react";
import type { Node } from "wordgard/doc";

import { DecorationContext } from "../contexts/DecorationContext.js";
import { createDecorationHandlers, decorationRoot } from "../decorations/decorationHandlers.js";
import { drawShape } from "../decorations/ReactShapeType.js";
import { atomRef, createShapeHandle, nodePos, shapeAttributes } from "../decorations/shapeType.js";
import { DecorationRootContext } from "../contexts/DecorationRootContext.js";
import { componentProps, useAttrsRecord } from "../helpers/index.js";
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
  const [handlers] = useState(() => createDecorationHandlers(nodePos(handle, "React")));
  const atom = !elt.hasContent;
  const rootRef = useMemo(
    () => mergeRefs(ref, outerRef, decorationRoot(handlers), atomRef(handle, atom)),
    [ref, outerRef, handlers, handle, atom]
  );
  const decoration = useMemo(() => ({ handlers, selected }), [handlers, selected]);
  const attrs = useAttrsRecord(shapeAttributes(elt));
  const root = useMemo(
    () => ({ tagName: elt.tagName, attrs, ref: rootRef }),
    [elt.tagName, attrs, rootRef]
  );
  return (
    <DecorationContext.Provider value={decoration}>
      <DecorationRootContext.Provider value={root}>
        {drawShape(elt, {
          attrs: componentProps(attrs),
          nodeProps: { node, getPos: handlers.getPos, contentDOMRef },
          children: content,
          ref: rootRef,
        })}
      </DecorationRootContext.Provider>
    </DecorationContext.Provider>
  );
};
