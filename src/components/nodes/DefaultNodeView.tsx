// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a
// node renders as the shape Wordgard's decorations give it (its
// buildNodeShape), with the plot's content in the hole. In Wordgard every node
// type has a shape, so there's no missing `toDOM` to check for. Widgets, as a
// node's shape or inside it, are drawn by their component when they're React
// widgets, else draw nothing: ReactDocTile puts their DOM in place.
import React, { type ReactElement, type ReactNode, createElement, memo } from "react";
import { Elt, type Node } from "wordgard/doc";

import { isReactShape } from "../../decorations/ReactShapeType.js";
import { isReactWidget } from "../../decorations/ReactWidgetType.js";
import { type NodeView, sameNodeView, uneditable } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { ChildNodeViews } from "../ChildNodeViews.js";
import { ShapeView } from "../ShapeView.js";
import { WidgetView } from "../WidgetView.js";
import { viewRoot } from "../../viewRoots.js";

type Props = {
  view: NodeView;
};

const renderShape = (
  node: Node,
  shape: DecoElt,
  inEditable: boolean,
  content: ReactNode,
  key?: number,
  ref?: (dom: Element | null) => void
): ReactElement => {
  if (isReactShape(shape)) return <ShapeView key={key} elt={shape} node={node} content={content} />;
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  const props = {
    key,
    ref,
    suppressContentEditableWarning: true,
    ...htmlAttrsToReactProps(attrsToRecord(elt.attrs)),
  };
  return createElement(
    elt.tagName,
    props,
    ...elt.children.map((child, i) => {
      if (child === 0) return content;
      if (typeof child == "string") return child;
      if (child instanceof Elt) return renderShape(node, child, inner, content, i);
      return isReactWidget(child) ? <WidgetView key={i} widget={child} /> : null;
    })
  );
};

// Skips nodes whose layout is the same: Wordgard's documents share unchanged
// nodes between states, and their layouts are kept outside redrawn ranges.
export const DefaultNodeView = memo(
  ({ view }: Props) => {
    const { node, shape, children } = view;
    if (!(shape instanceof Elt)) return isReactWidget(shape) ? <WidgetView widget={shape} /> : null;
    // Keyed, so React keeps the content where a shape moves its hole: the tile
    // build counts on an element React kept keeping its content.
    return renderShape(
      node,
      shape,
      true,
      node.isPlot && children ? <ChildNodeViews key="content" views={children} /> : null,
      undefined,
      viewRoot
    );
  },
  (a, b) => sameNodeView(a.view, b.view)
);
