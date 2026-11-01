// Named after react-prosemirror's ReactMarkView, rewritten for Wordgard: draws
// a React mark's component around the marked content. As ShapeView, it has no
// effects: ReactDocTile builds the tiles over what it commits, and the
// component's own commits are sorted out of Wordgard's DOM observer.
import { type ReactNode, useState } from "react";
import type { Mark } from "wordgard/doc";

import { drawMark } from "../../decorations/ReactMarkType.js";
import { createShapeHandle, shapeAttributes } from "../../decorations/ReactShapeType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  mark: Mark;
  children: ReactNode;
};

export const ReactMarkView = ({ elt, mark, children }: Props) => {
  const [{ handle, ref, contentDOMRef }] = useState(createShapeHandle);
  const [getPos] = useState(() => () => {
    const tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
    if (!tile) throw new Error("This React mark isn't drawn");
    return tile.posBefore;
  });
  return drawMark(elt, {
    attrs: htmlAttrsToReactProps(attrsToRecord(shapeAttributes(elt))),
    markProps: { mark, getPos, contentDOMRef },
    children,
    ref,
  });
};
