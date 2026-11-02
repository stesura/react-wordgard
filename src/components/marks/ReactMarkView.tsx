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
import { DecorationRootContext } from "../../contexts/DecorationRootContext.js";
import { attrsToRecord, componentProps } from "../../helpers/index.js";
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
  const attrs = useMemo(() => attrsToRecord(shapeAttributes(elt)), [elt]);
  const root = useMemo(
    () => ({ tagName: elt.tagName, attrs, ref: rootRef }),
    [elt.tagName, attrs, rootRef]
  );
  return (
    <DecorationContext.Provider value={decoration}>
      <DecorationRootContext.Provider value={root}>
        {drawMark(elt, {
          attrs: componentProps(attrs),
          markProps: { mark, getPos: handlers.getPos, contentDOMRef },
          children,
          ref: rootRef,
        })}
      </DecorationRootContext.Provider>
    </DecorationContext.Provider>
  );
};
