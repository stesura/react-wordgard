// Like ShapeView, no effects: ReactDocTile builds the tiles over what it commits.
import React, { type ReactNode, useMemo, useState } from "react";
import type { Node } from "wordgard/doc";

import {
  DecorationContext,
  createDecorationHandlers,
  decorationRoot,
} from "../contexts/DecorationContext.js";
import { createWrapperHandle, nodePos, shapeAttributes } from "../decorations/ReactShapeType.js";
import { drawWrapper } from "../decorations/ReactWrapperType.js";
import { DecorationRootContext } from "../contexts/DecorationRootContext.js";
import { attrsToRecord, componentProps } from "../helpers/index.js";
import { mergeRefs } from "../helpers/refs.js";
import type { DecoElt } from "../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  node: Node;
  // Draws what's wrapped, its root's ref given.
  wrapped: (ref: (dom: Element | null) => void) => ReactNode;
  selected: boolean;
  outerRef?: ((dom: Element | null) => void) | undefined;
};

export const WrapperView = ({ elt, node, wrapped, selected, outerRef }: Props) => {
  const [{ handle, ref, wrappedRef }] = useState(createWrapperHandle);
  const [handlers] = useState(() => createDecorationHandlers(nodePos(handle)));
  const rootRef = useMemo(
    () => mergeRefs(ref, outerRef, decorationRoot(handlers)),
    [ref, outerRef, handlers]
  );
  const decoration = useMemo(() => ({ handlers, selected }), [handlers, selected]);
  const attrs = useMemo(() => attrsToRecord(shapeAttributes(elt)), [elt]);
  const root = useMemo(
    () => ({ tagName: elt.tagName, attrs, ref: rootRef }),
    [elt.tagName, attrs, rootRef]
  );
  return (
    <DecorationContext.Provider value={decoration}>
      <DecorationRootContext.Provider value={root}>
        {drawWrapper(elt, {
          attrs: componentProps(attrs),
          nodeProps: { node, getPos: handlers.getPos },
          children: wrapped(wrappedRef),
          ref: rootRef,
        })}
      </DecorationRootContext.Provider>
    </DecorationContext.Provider>
  );
};
