// Named after react-prosemirror's ReactMarkView, rewritten for Wordgard: draws
// a React mark's component around the marked content. As ShapeView, it has no
// effects: ReactDocTile builds the tiles over what it commits, and the
// component's own commits are sorted out of Wordgard's DOM observer.
import React, { type ReactNode, useMemo, useState } from "react";
import type { Mark } from "wordgard/doc";

import {
  DecorationContext,
  createDecorationHandlers,
  decorationRoot,
} from "../../contexts/DecorationContext.js";
import { drawMark } from "../../decorations/ReactMarkType.js";
import { createShapeHandle, shapeAttributes } from "../../decorations/ReactShapeType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import { mergeRefs } from "../../helpers/refs.js";
import type { DecoElt } from "../../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  mark: Mark;
  children: ReactNode;
};

export const ReactMarkView = ({ elt, mark, children }: Props) => {
  const [{ handle, ref, contentDOMRef }] = useState(createShapeHandle);
  const [handlers] = useState(() =>
    createDecorationHandlers(() => {
      const tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
      if (!tile) throw new Error("This React mark isn't drawn");
      return tile.posBefore;
    })
  );
  const rootRef = useMemo(() => mergeRefs(ref, decorationRoot(handlers)), [ref, handlers]);
  // A mark is no node: never selected.
  const decoration = useMemo(() => ({ handlers, selected: false }), [handlers]);
  return (
    <DecorationContext.Provider value={decoration}>
      {drawMark(elt, {
        attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
        markProps: { mark, getPos: handlers.getPos, contentDOMRef },
        children,
        ref: rootRef,
      })}
    </DecorationContext.Provider>
  );
};
