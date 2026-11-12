// Adapted from react-wordgard's DefaultNodeView for Vue: a node renders as its decorated shape
// (buildNodeShape), its content in the hole as the hole element's own children. A component, with
// one root: Vue renders it again only when its view is another object, as iterDeco keeps the
// views of what didn't change. Native widgets in the shape draw nothing: the doc tile puts their
// DOM in place.
import { Text, type VNode, createVNode, defineComponent, h } from "vue";
import { Elt, type Node } from "wordgard/doc";

import { type NodeView, uneditable } from "../../../../src/decorations/iterDeco.js";
import { isReactShape } from "../../../../src/decorations/shapeType.js";
import { attributedWidget, isReactWidget } from "../../../../src/decorations/widgetType.js";
import { isReactWrapper } from "../../../../src/decorations/wrapperType.js";
import { localTagName } from "../../../../src/helpers/elt.js";
import type { DecoElt } from "../../../../src/wordgardInternals.js";
import { eltProps } from "../../helpers/props.js";
import { renderChildViews, unsupported } from "../ChildNodeViews.js";

const renderShape = (
  node: Node,
  content: readonly VNode[],
  shape: DecoElt,
  inEditable: boolean,
  key?: number
): VNode => {
  if (attributedWidget(shape) || isReactShape(shape) || isReactWrapper(shape))
    throw unsupported(node.name);
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  const children: VNode[] = [];
  elt.children.forEach((child, i) => {
    if (child === 0) children.push(...content);
    else if (typeof child == "string") children.push(createVNode(Text, { key: i }, child));
    else if (child instanceof Elt) children.push(renderShape(node, content, child, inner, i));
    else if (isReactWidget(child)) throw unsupported(node.name);
  });
  return h(localTagName(elt.tagName), { key, ...eltProps(elt.attrs) }, children);
};

const draw = ({ node, shape, children }: NodeView) => {
  if (!(shape instanceof Elt)) throw new Error("Expected an element shape");
  const content = node.isPlot && children ? renderChildViews(children) : [];
  return renderShape(node, content, shape, true);
};

export const DefaultNodeView = defineComponent(
  (props: { view: NodeView }) => () => draw(props.view),
  {
    props: ["view"],
  }
);
