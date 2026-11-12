// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a node renders as its
// decorated shape (buildNodeShape). Every Wordgard node type has a shape, so there's no missing
// `toDOM` to check for. Native widgets draw nothing: ReactDocTile puts their DOM in place.
import React, {
  Component,
  type ContextType,
  type ReactElement,
  type ReactNode,
  createElement,
} from "react";
import { Attributes, Elt, type Node } from "wordgard/doc";

import { NodeWrapperContext } from "../../contexts/NodeWrapperContext.js";
import { DrawnRoot } from "../NodeRootProps.js";
import type { NodeWrappers } from "../../decorations/ReactNodeWrapper.js";
import { isReactShape, nodePos, shapeAttributes } from "../../decorations/shapeType.js";
import { attributedWidget, isReactWidget } from "../../decorations/widgetType.js";
import { isReactWrapper } from "../../decorations/wrapperType.js";
import type { NodeCell } from "../../renderStore.js";
import { type NodeView, uneditable } from "../../decorations/iterDeco.js";
import { attrsToRecord, eltProps, reactTagName } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { ChildNodeViews } from "../ChildNodeViews.js";
import { ShapeView } from "../ShapeView.js";
import { WidgetView } from "../WidgetView.js";
import { WrapperView } from "../WrapperView.js";
import { viewRoot } from "../../viewRoots.js";

type Props = {
  cell: NodeCell;
};

// What every part of a node's shape is drawn with: the node, its content for
// the hole, and whether the node is selected, for the React decorations in it.
type NodeDraw = {
  node: Node;
  content: ReactNode;
  selected: boolean;
  /** It has node wrappers: an element Wordgard draws for it takes their props (`NodeRootProps`). */
  wrapped: boolean;
};

const renderShape = (
  draw: NodeDraw,
  shape: DecoElt,
  inEditable: boolean,
  key?: number,
  ref?: (dom: Element | null) => void,
  root = false
): ReactElement => {
  const { node, content, selected } = draw;
  const widget = attributedWidget(shape);
  if (widget)
    return (
      <WidgetView
        key={key}
        widget={widget}
        attrs={shapeAttributes(uneditable(shape, inEditable).shape)}
        selected={selected}
        outerRef={ref}
      />
    );
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  // Wordgard fills a wrapper's hole with what it wraps, which a React shape
  // would drop.
  if (isReactShape(elt) && (elt.children.length > 1 || elt.children.some((child) => child !== 0)))
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
  const children = elt.children.map((child, i) => {
    if (child === 0) return content;
    if (typeof child == "string") return child;
    if (child instanceof Elt) return renderShape(draw, child, inner, i);
    return isReactWidget(child) ? <WidgetView key={i} widget={child} selected={selected} /> : null;
  });
  if (root && draw.wrapped)
    return createElement(DrawnRoot, {
      key,
      node,
      tagName: elt.tagName,
      attrs: attrsToRecord(elt.attrs),
      elementRef: ref,
      children,
    });
  const props = {
    key,
    ref,
    suppressContentEditableWarning: true,
    ...eltProps(elt.tagName, attrsToRecord(elt.attrs)),
  };
  return createElement(reactTagName(elt.tagName), props, ...children);
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

type DOMRef = (dom: Element | null) => void;

// `widgetRef` gets the root of a node drawn as a React widget, `ref` any other.
const draw = (
  { node, shape, children }: NodeView,
  wrapped: boolean,
  ref: DOMRef,
  widgetRef: DOMRef
) => {
  if (!(shape instanceof Elt))
    return isReactWidget(shape) ? <WidgetView widget={shape} outerRef={widgetRef} /> : null;
  // Keyed, so React keeps the content where a shape moves its hole: the tile
  // build counts on an element React kept keeping its content.
  const content =
    node.isPlot && children ? <ChildNodeViews key="content" views={children} /> : null;
  return renderShape(
    { node, content, selected: isSelected(shape), wrapped },
    shape,
    true,
    undefined,
    ref,
    true
  );
};

// The node wrappers around a drawing, the first outermost.
const wrap = (
  wrappers: NodeWrappers,
  node: Node,
  getPos: () => number,
  drawing: ReactElement | null
): ReactElement | null => {
  const components = wrappers.of(node.type);
  if (!components) return drawing;
  const nodeProps = { node, getPos };
  return components.reduceRight<ReactElement | null>(
    (inner, component) => createElement(component, { nodeProps, children: inner }),
    drawing
  );
};

// Renders when its cell gets a new view, not when its list renders again:
// Wordgard's documents share unchanged nodes between states, and their layouts
// are kept outside redrawn ranges. A class, so a node's listener costs no hook
// state and an update no effect (useSyncExternalStore made Bold all over 5,000
// paragraphs about 15% slower, and held more memory).
export class DefaultNodeView extends Component<Props> {
  // Its node wrappers, a context, so a reconfiguration's render reaches every node.
  static contextType = NodeWrapperContext;
  declare context: ContextType<typeof NodeWrapperContext>;
  // What it drew last, to catch a view its cell got before it listened.
  private drawn: NodeView | null = null;
  private readonly redraw = () => this.forceUpdate();
  // The node's root element, for its wrappers' `getPos`.
  private readonly root: { root: Element | null } = { root: null };
  private readonly widgetRef = (dom: Element | null) => {
    this.root.root = dom;
  };
  private readonly rootRef = (dom: Element | null) => {
    viewRoot(dom);
    this.widgetRef(dom);
  };
  private readonly getPos = nodePos(this.root, "React");

  shouldComponentUpdate(next: Props) {
    return next.cell != this.props.cell;
  }

  componentDidMount() {
    this.listen();
  }

  componentDidUpdate(prev: Props) {
    if (prev.cell == this.props.cell) return;
    if (prev.cell.listener == this.redraw) prev.cell.listener = null;
    this.listen();
  }

  componentWillUnmount() {
    const { cell } = this.props;
    if (cell.listener == this.redraw) cell.listener = null;
  }

  private listen() {
    const { cell } = this.props;
    cell.listener = this.redraw;
    if (cell.view != this.drawn) this.forceUpdate();
  }

  render() {
    const view = (this.drawn = this.props.cell.view);
    const wrapped = !!this.context.of(view.node.type);
    return wrap(
      this.context,
      view.node,
      this.getPos,
      draw(view, wrapped, this.rootRef, this.widgetRef)
    );
  }
}
