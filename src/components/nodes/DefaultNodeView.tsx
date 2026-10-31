// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a
// node renders as the shape Wordgard's decorations give it (its
// buildNodeShape), with the plot's content in the hole. In Wordgard every node
// type has a shape, so there's no missing `toDOM` to check for. Widgets, as a
// node's shape or inside it, draw nothing: ReactDocTile puts their DOM in place.
import React, { type ReactElement, type ReactNode, createElement, memo } from "react";
import { Elt } from "wordgard/doc";

import { type NodeView, sameNodeView, uneditable } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  view: NodeView;
};

const renderShape = (
  shape: DecoElt,
  inEditable: boolean,
  content: ReactNode,
  key?: number
): ReactElement => {
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  const props = {
    key,
    suppressContentEditableWarning: true,
    ...htmlAttrsToReactProps(attrsToRecord(elt.attrs)),
  };
  return createElement(
    elt.tagName,
    props,
    ...elt.children.map((child, i) => {
      if (child === 0) return content;
      if (typeof child == "string") return child;
      if (child instanceof Elt) return renderShape(child, inner, content, i);
      return null;
    })
  );
};

// Skips nodes whose layout is the same: Wordgard's documents share unchanged
// nodes between states, and their layouts are kept outside redrawn ranges.
export const DefaultNodeView = memo(
  ({ view }: Props) => {
    const { node, shape, children } = view;
    if (!(shape instanceof Elt)) return null;
    return renderShape(
      shape,
      true,
      node.isPlot && children ? <ChildNodeViews node={node} views={children} /> : null
    );
  },
  (a, b) => sameNodeView(a.view, b.view)
);
