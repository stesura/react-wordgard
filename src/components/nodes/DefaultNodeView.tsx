// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a
// node renders as the shape Wordgard's decorations give it (its
// buildNodeShape), with the plot's content in the hole. In Wordgard every node
// type has a shape, so there's no missing `toDOM` to check for. Widgets, as a
// node's shape or inside it, are drawn by their component when they're React
// widgets, else draw nothing: ReactDocTile puts their DOM in place. React
// shapes and wrappers in the shape are drawn by ShapeView and WrapperView.
import React, { type ReactElement, type ReactNode, createElement, memo } from "react";
import { Attributes, Elt, type Node } from "wordgard/doc";

import { isReactShape, shapeAttributes } from "../../decorations/ReactShapeType.js";
import { attributedWidget, isReactWidget } from "../../decorations/ReactWidgetType.js";
import { isReactWrapper } from "../../decorations/ReactWrapperType.js";
import { type NodeView, sameNodeView, uneditable } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { ChildNodeViews } from "../ChildNodeViews.js";
import { ShapeView } from "../ShapeView.js";
import { WidgetView } from "../WidgetView.js";
import { WrapperView } from "../WrapperView.js";
import { viewRoot } from "../../viewRoots.js";

type Props = {
  view: NodeView;
};

// What every part of a node's shape is drawn with: the node, its content for
// the hole, and whether the node is selected, for the React decorations in it.
type NodeDraw = {
  node: Node;
  content: ReactNode;
  selected: boolean;
};

const renderShape = (
  draw: NodeDraw,
  shape: DecoElt,
  inEditable: boolean,
  key?: number,
  ref?: (dom: Element | null) => void
): ReactElement => {
  const { node, content, selected } = draw;
  const widget = attributedWidget(shape);
  if (widget)
    return (
      <WidgetView
        key={key}
        widget={widget}
        attrs={shapeAttributes(shape)}
        selected={selected}
        outerRef={ref}
      />
    );
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  // Wordgard fills a wrapper's hole with what it wraps, which a React shape
  // would drop.
  if (isReactShape(elt) && (elt.children.length != 1 || elt.children[0] !== 0))
    throw new Error("A React shape can't wrap: use createWrapper");
  if (isReactShape(elt))
    return (
      <ShapeView
        key={key}
        elt={elt}
        node={node}
        content={content}
        selected={selected}
        outerRef={ref}
      />
    );
  if (isReactWrapper(elt))
    return (
      <WrapperView
        key={key}
        elt={elt}
        node={node}
        wrapped={(wrappedRef) => renderWrapped(draw, elt, inner, wrappedRef)}
        selected={selected}
        outerRef={ref}
      />
    );
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
      if (child instanceof Elt) return renderShape(draw, child, inner, i);
      return isReactWidget(child) ? (
        <WidgetView key={i} widget={child} selected={selected} />
      ) : null;
    })
  );
};

// What a React wrapper wraps: its hole holds one element or widget, whose root
// the wrapper's tiles are built down to. A native widget's DOM is placed after
// the commit, where React drew nothing: there'd be no telling where the
// component put its children.
const renderWrapped = (
  draw: NodeDraw,
  wrapper: DecoElt,
  inEditable: boolean,
  ref: (dom: Element | null) => void
): ReactElement => {
  const [child, ...rest] = wrapper.children;
  if (child === 0) throw new Error("A React wrapper isn't a shape: use createShape");
  if (rest.length || child === undefined || typeof child == "string")
    throw new Error("A React wrapper's hole holds one element or widget");
  if (child instanceof Elt) return renderShape(draw, child, inEditable, undefined, ref);
  if (!isReactWidget(child))
    throw new Error(
      `A React wrapper can't wrap a native widget: draw ${draw.node.name} with a React widget`
    );
  return <WidgetView widget={child} selected={draw.selected} outerRef={ref} />;
};

// Wordgard draws a node selection as a class on the node's shape: on its outer
// element (a widget-drawn node gets one around it), or inside a wrapper a point
// decoration added after it.
const isSelected = (shape: DecoElt): boolean =>
  (Attributes.get(shape.attrs, "class") ?? "").split(" ").includes("wg-selected-node") ||
  shape.children.some((child) => child instanceof Elt && isSelected(child));

// Skips nodes whose layout is the same: Wordgard's documents share unchanged
// nodes between states, and their layouts are kept outside redrawn ranges.
export const DefaultNodeView = memo(
  ({ view }: Props) => {
    const { node, shape, children } = view;
    if (!(shape instanceof Elt)) return isReactWidget(shape) ? <WidgetView widget={shape} /> : null;
    // Keyed, so React keeps the content where a shape moves its hole: the tile
    // build counts on an element React kept keeping its content.
    const content =
      node.isPlot && children ? <ChildNodeViews key="content" views={children} /> : null;
    return renderShape(
      { node, content, selected: isSelected(shape) },
      shape,
      true,
      undefined,
      viewRoot
    );
  },
  (a, b) => sameNodeView(a.view, b.view)
);
