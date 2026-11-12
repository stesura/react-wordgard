// Adapted from react-wordgard's DefaultNodeView for Vue: a node renders as its decorated shape
// (buildNodeShape), its content in the hole as the hole element's own children, Vue shapes,
// wrappers and widgets as their components, inside the node's wrappers (NodeWrapperView). A
// component with one root: Vue renders it again only when its view is another object, as iterDeco
// keeps the views of what didn't change. Native widgets draw nothing: the doc tile puts their DOM
// in place.
import { Text, type VNode, createVNode, defineComponent, h, inject } from "vue";
import { Attributes, Elt, type Node } from "wordgard/doc";

import { type ChildView, type NodeView, uneditable } from "../../../../src/decorations/iterDeco.js";
import { isReactShape, nodePos, shapeAttributes } from "../../../../src/decorations/shapeType.js";
import { attributedWidget, isReactWidget } from "../../../../src/decorations/widgetType.js";
import { isReactWrapper } from "../../../../src/decorations/wrapperType.js";
import { localTagName } from "../../../../src/helpers/elt.js";
import { drawnRoot, viewRoot } from "../../../../src/viewRoots.js";
import type { DecoElt } from "../../../../src/wordgardInternals.js";
import { NodeWrappersKey } from "../../contexts/EditorContext.js";
import { decorationProps, eltProps } from "../../helpers/props.js";
import { type DOMRef, withRef } from "../../helpers/refs.js";
import { updateInFlush } from "../../sync.js";
import { vueWords } from "../../words.js";
import { renderChildViews } from "../ChildNodeViews.js";
import { NodeWrapperView } from "../NodeWrapperView.js";
import { ShapeView } from "../ShapeView.js";
import { WidgetView } from "../WidgetView.js";
import { WrapperView } from "../WrapperView.js";

// What every part of a node's shape is drawn with: the node, its content's
// views (for a Vue shape) and vnodes (for the hole of one Wordgard draws), and
// whether the node is selected, for the Vue decorations in it.
type NodeDraw = {
  node: Node;
  views: readonly ChildView[] | null;
  content: () => VNode[];
  selected: boolean;
  // It has node wrappers, whose attributes fall through to its root element.
  wrapped: boolean;
};

const renderShape = (
  draw: NodeDraw,
  shape: DecoElt,
  inEditable: boolean,
  key?: number,
  ref?: DOMRef,
  root = false
): VNode => {
  const { node, selected } = draw;
  const widget = attributedWidget(shape);
  if (widget) {
    const attrs = shapeAttributes(uneditable(shape, inEditable).shape);
    return h(WidgetView, { key, widget, attrs, selected, outerRef: ref });
  }
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  // Wordgard fills a wrapper's hole with what it wraps, which a Vue shape
  // would drop.
  if (isReactShape(elt) && (elt.children.length > 1 || elt.children.some((child) => child !== 0)))
    throw new Error("A Vue shape can't wrap: use createWrapper");
  if (isReactShape(elt))
    return h(ShapeView, { key, elt, node, content: draw.views, selected, outerRef: ref });
  if (isReactWrapper(elt)) {
    const wrapped = (wrappedRef: DOMRef) => renderWrapped(draw, elt, inner, wrappedRef);
    return h(WrapperView, { key, elt, node, wrapped, selected, outerRef: ref });
  }
  const children: VNode[] = [];
  elt.children.forEach((child, i) => {
    if (child === 0) children.push(...draw.content());
    else if (typeof child == "string") children.push(createVNode(Text, { key: i }, child));
    else if (child instanceof Elt) children.push(renderShape(draw, child, inner, i));
    else if (isReactWidget(child))
      children.push(h(WidgetView, { key: i, widget: child, selected }));
  });
  // A wrapped node's root merges its `class` and `style` with its wrappers'.
  const props = root && draw.wrapped ? decorationProps(elt.attrs) : eltProps(elt.attrs);
  const vnode = h(localTagName(elt.tagName), { key, ...props }, children);
  return ref ? withRef(vnode, ref) : vnode;
};

// What a Vue wrapper wraps: its hole holds one element or widget, whose root
// the wrapper's tiles are built down to. A native widget's DOM is placed after
// the commit, where Vue drew nothing: there'd be no telling where the
// component put its WrappedNode.
const renderWrapped = (
  draw: NodeDraw,
  wrapper: DecoElt,
  inEditable: boolean,
  ref: DOMRef
): VNode => {
  const [child, ...rest] = wrapper.children;
  if (child === 0) throw new Error("A Vue wrapper isn't a shape: use createShape");
  if (rest.length || child === undefined || typeof child == "string")
    throw new Error("A Vue wrapper's hole holds one element or widget");
  if (child instanceof Elt) return renderShape(draw, child, inEditable, undefined, ref);
  if (!isReactWidget(child))
    throw new Error(
      `A Vue wrapper can't wrap a native widget: draw ${draw.node.name} with a Vue widget`
    );
  return h(WidgetView, { widget: child, selected: draw.selected, outerRef: ref });
};

// Wordgard draws a node selection as a class on the node's shape: on its outer
// element (a widget-drawn node gets one around it), or inside a wrapper a point
// decoration added after it.
const isSelected = (shape: DecoElt): boolean =>
  (Attributes.get(shape.attrs, "class") ?? "").split(" ").includes("wg-selected-node") ||
  shape.children.some((child) => child instanceof Elt && isSelected(child));

// `widgetRef` gets the root of a node drawn as a Vue widget, `ref` any other.
// Only element shapes and Vue widgets get a DefaultNodeView (ChildNodeViews).
const drawView = (
  { node, shape, children }: NodeView,
  wrapped: boolean,
  ref: DOMRef,
  widgetRef: DOMRef
): VNode => {
  if (!(shape instanceof Elt)) return h(WidgetView, { widget: shape, outerRef: widgetRef });
  const views = node.isPlot ? children : null;
  const content = () => (views ? renderChildViews(views) : []);
  const draw = { node, views, content, selected: isSelected(shape), wrapped };
  return renderShape(draw, shape, true, undefined, ref, true);
};

export const DefaultNodeView = defineComponent(
  (props: { view: NodeView }) => {
    // A reconfiguration changing the wrappers draws a node whose view is kept.
    const wrappers = inject(NodeWrappersKey, null);
    updateInFlush();
    // The node's root element, for its wrappers' `getPos`.
    const root: { root: Element | null } = { root: null };
    const getPos = nodePos(root, vueWords.name);
    let wrapped = false;
    // A wrapped node's root takes its wrappers' attributes: Vue's, as a Vue
    // shape's root's are (sortRecords drops those records).
    const widgetRef: DOMRef = (dom) => {
      root.root = dom;
      if (wrapped) drawnRoot(dom);
    };
    const rootRef: DOMRef = (dom) => {
      viewRoot(dom);
      widgetRef(dom);
    };
    let nodeProps = { node: props.view.node, getPos };
    return () => {
      const { view } = props;
      const components = wrappers?.value.of(view.node.type);
      wrapped = !!components;
      const drawing = () => drawView(view, wrapped, rootRef, widgetRef);
      if (!components) return drawing();
      if (nodeProps.node != view.node) nodeProps = { node: view.node, getPos };
      return h(NodeWrapperView, { components, index: 0, nodeProps, draw: drawing });
    };
  },
  { props: ["view"] }
);
